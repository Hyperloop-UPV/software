package transport

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/sniffer"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/tcp"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/tftp"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/udp"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/presentation"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/session"
	"github.com/rs/zerolog"
)

// Transport is the module in charge of handling network communication with
// the vehicle.
//
// It uses events to differentiate different kinds of messages. Each message
// or notification has an associated event which is used to determine the
// action to take.
type Transport struct {
	decoder *presentation.Decoder
	encoder *presentation.Encoder

	connectionsMx *sync.Mutex
	connections   map[abstraction.TransportTarget]net.Conn

	ipToTarget map[string]abstraction.TransportTarget
	idToTarget map[abstraction.PacketId]abstraction.TransportTarget

	tftp *tftp.Client

	propagateFault bool

	api abstraction.TransportAPI

	logger zerolog.Logger

	errChan chan error
}

// HandleClient connects to the specified client and handles its messages. This method blocks.
// This method will continuously try to reconnect to the client if it disconnects,
// applying exponential backoff between attempts.
func (transport *Transport) HandleClient(config tcp.ClientConfig, remote string) error {
	client := tcp.NewClient(remote, config, transport.logger)
	defer transport.logger.Warn().Str("remoteAddress", remote).Msg("abort connection")
	var hasConnected = false

	for {
		conn, err := client.Dial()
		if err != nil {
			transport.logger.Debug().Stack().Err(err).Str("remoteAddress", remote).Msg("dial failed")

			// Only return if reconnection is disabled
			if !config.TryReconnect {
				if hasConnected {
					transport.SendFault()
				}
				transport.errChan <- err
				return err
			}

			// For ErrTooManyRetries, we still want to continue retrying
			// The client will reset its retry counter on the next Dial() call
			if _, ok := err.(tcp.ErrTooManyRetries); ok {
				transport.logger.Warn().Str("remoteAddress", remote).Msg("reached max retries, will continue attempting to reconnect")
				// Add a longer delay before restarting the retry cycle
				time.Sleep(config.ConnectionBackoffFunction(config.MaxConnectionRetries))
			}

			continue
		}

		hasConnected = true

		err = transport.handleTCPConn(conn)
		if errors.Is(err, error(ErrTargetAlreadyConnected{})) {
			transport.logger.Warn().Stack().Err(err).Str("remoteAddress", remote).Msg("multiple connections for same target")
			transport.errChan <- err
			return err
		}
		if err != nil {
			transport.logger.Debug().Stack().Err(err).Str("remoteAddress", remote).Msg("connection lost")
			if !config.TryReconnect {
				transport.SendFault()
				transport.errChan <- err
				return err
			}

			// Connection was lost, continue trying to reconnect
			continue
		}
	}
}

// HandleServer creates a server on the specified address, listening for all incoming connections and
// handles them.
func (transport *Transport) HandleServer(config tcp.ServerConfig, local string) error {
	server := tcp.NewServer(local, config, transport.logger)
	for addr := range transport.ipToTarget {
		server.AddToWhitelist(addr)
	}
	server.OnConnection(transport.handleTCPConn)
	err := server.Listen()
	transport.errChan <- err
	return err
}

// handleTCPConn is used to handle the specific TCP connections to the boards. It detects errors caused
// on concurrent reads and writes, so other routines should not worry about closing or handling errors
func (transport *Transport) handleTCPConn(conn net.Conn) error {
	transport.configureTCPConn(conn)

	target, err := transport.targetFromTCPConn(conn)
	if err != nil {
		return err
	}

	connectionLogger := transport.logger.With().Str("remoteAddress", conn.RemoteAddr().String()).Str("target", string(target)).Logger()
	connectionLogger.Info().Msg("new connection")

	if err := transport.rejectIfConnectedTCPConn(target, conn, connectionLogger); err != nil {
		transport.errChan <- err
		return err
	}

	conn, errChan := tcp.WithErrChan(conn)
	defer func() {
		conn.Close()
		connectionLogger.Info().Msg("close")
	}()

	cleanupConn := transport.registerTCPConn(target, conn, connectionLogger)
	defer cleanupConn()

	transport.api.ConnectionUpdate(target, true)
	defer transport.api.ConnectionUpdate(target, false)

	transport.readLoopTCPConn(conn, connectionLogger)

	err = <-errChan
	if err != nil {
		connectionLogger.Error().Stack().Err(err).Msg("")
		transport.errChan <- err
	}
	return err
}

// configureTCPConn sets TCP-level options like linger and no-delay.
func (transport *Transport) configureTCPConn(conn net.Conn) {
	tcpConn, ok := conn.(*net.TCPConn)
	if !ok {
		return
	}

	remote := conn.RemoteAddr().String()

	transport.logger.Trace().Str("remoteAddress", remote).Msg("setting connection linger")
	err := tcpConn.SetLinger(0)
	if err != nil {
		transport.errChan <- err
		transport.logger.Error().Stack().Err(err).Str("remoteAddress", remote).Msg("set linger")
	}

	transport.logger.Trace().Str("remoteAddress", remote).Msg("setting connection no delay")
	err = tcpConn.SetNoDelay(true)
	if err != nil {
		transport.errChan <- err
		transport.logger.Error().Stack().Err(err).Str("remoteAddress", remote).Msg("set no delay")
	}
}

// targetFromTCPConn maps the remote IP address of the connection to a TransportTarget
// using the ipToTarget map.
func (transport *Transport) targetFromTCPConn(conn net.Conn) (abstraction.TransportTarget, error) {
	remoteAddr := conn.RemoteAddr().(*net.TCPAddr)
	ip := remoteAddr.IP.String()

	target, ok := transport.ipToTarget[ip]
	if !ok {
		conn.Close()
		transport.logger.Warn().Str("remoteAddress", ip).Msg("ip target not found")
		err := ErrUnknownTarget{Remote: conn.RemoteAddr()}
		transport.errChan <- err
		var zero abstraction.TransportTarget
		return zero, err

	}
	return target, nil
}

// rejectIfConnectedTCPConn closes and rejects conn if target already has an active connection.
func (transport *Transport) rejectIfConnectedTCPConn(target abstraction.TransportTarget, conn net.Conn, logger zerolog.Logger,) error {
	transport.connectionsMx.Lock()
	defer transport.connectionsMx.Unlock()

	if _, ok := transport.connections[target]; ok {
		conn.Close()
		logger.Debug().Msg("already connected")
		err := ErrTargetAlreadyConnected{Target: target}
		transport.errChan <- err
		return err
	}
	return nil
}

// registerTCPConn stores conn for target and returns a cleanup that removes it.
func (transport *Transport) registerTCPConn(target abstraction.TransportTarget, conn net.Conn, logger zerolog.Logger) func() {
	transport.connectionsMx.Lock()
	logger.Debug().Msg("added connection")
	transport.connections[target] = conn
	transport.connectionsMx.Unlock()

	return func() {
		transport.connectionsMx.Lock()
		logger.Debug().Msg("removed connection")
		delete(transport.connections, target)
		transport.connectionsMx.Unlock()
	}
}

// readLoopTCPConn reads packets from conn and forwards notifications until an error occurs.
func (transport *Transport) readLoopTCPConn(conn net.Conn, logger zerolog.Logger) {
	from := conn.RemoteAddr().String()
	to := conn.LocalAddr().String()
	
	go func() {
		for {
			packet, err := transport.decoder.DecodeNext(conn)
			if err != nil {
				logger.Error().Stack().Err(err).Msg("decode")
				transport.errChan <- err
				transport.SendFault()
				return
			}

			if transport.propagateFault && packet.Id() == 0 {
				logger.Info().Msg("replicating packet with id 0 to all boards")
				err := transport.handlePacketEvent(NewPacketMessage(packet))
				if err != nil {
					logger.Error().Err(err).Msg("failed to replicate packet")
				}
			}

			logger.Trace().Type("type", packet).Msg("packet")
			transport.api.Notification(NewPacketNotification(packet, from, to, time.Now()))
		}
	}()
}


// SendMessage triggers an event to send something to the vehicle. Some messages
// might additional means to pass information around (e.g. file read and write)
func (transport *Transport) SendMessage(message abstraction.TransportMessage) error {
	transport.logger.Info().Type("type", message).Msg("sending")
	err := error(nil)
	switch msg := message.(type) {
	case PacketMessage:
		err = transport.handlePacketEvent(msg)
	case FileWriteMessage:
		err = transport.handleFileWrite(msg)
	case FileReadMessage:
		err = transport.handleFileRead(msg)
	default:
		err = ErrUnrecognizedEvent{message.Event()}
	}
	// handlePacketEvent already sends the error through the channel, so this avoids duplicates
	if err != nil {
		if _, ok := err.(ErrConnClosed); !ok {
			transport.errChan <- err
		}
	}
	return err
}

// handlePacketEvent is used to send an order to one of the connected boards
func (transport *Transport) handlePacketEvent(message PacketMessage) error {
	eventLogger := transport.logger.With().Str("type", fmt.Sprintf("%T", message.Packet)).Uint16("id", uint16(message.Id())).Logger()

	if message.Id() == 0 {
		eventLogger.Info().Msg("broadcasting packet id 0")
		data, err := transport.encoder.Encode(message.Packet)
		if err != nil {
			eventLogger.Error().Stack().Err(err).Msg("encode")
			transport.errChan <- err
			return err
		}

		transport.connectionsMx.Lock()
		defer transport.connectionsMx.Unlock()
		for target, conn := range transport.connections {
			eventLogger := eventLogger.With().Str("target", string(target)).Logger()

			totalWritten := 0
			for totalWritten < len(data) {
				n, err := conn.Write(data[totalWritten:])
				eventLogger.Trace().Int("amount", n).Msg("written chunk")
				totalWritten += n
				if err != nil {
					eventLogger.Error().Stack().Err(err).Msg("write")
					transport.errChan <- err
					return err
				}
			}
			eventLogger.Info().Msg("sent")
		}
		return nil
	}

	target, ok := transport.idToTarget[message.Id()]
	if !ok {
		eventLogger.Debug().Msg("target not found")
		err := ErrUnrecognizedId{Id: message.Id()}
		transport.errChan <- err
		return err
	}
	eventLogger = eventLogger.With().Str("target", string(target)).Logger()
	eventLogger.Info().Msg("sending")

	conn, err := func() (net.Conn, error) {
		transport.connectionsMx.Lock()
		defer transport.connectionsMx.Unlock()
		conn, ok := transport.connections[target]
		if !ok {
			eventLogger.Warn().Msg("target not connected")

			err := ErrConnClosed{Target: target}
			return nil, err
		}
		return conn, nil
	}()
	if err != nil {
		transport.errChan <- err
		return err
	}

	data, err := transport.encoder.Encode(message.Packet)
	if err != nil {
		eventLogger.Error().Stack().Err(err).Msg("encode")
		transport.errChan <- err
		return err
	}

	totalWritten := 0
	for totalWritten < len(data) {
		n, err := conn.Write(data[totalWritten:])
		eventLogger.Trace().Int("amount", n).Msg("written chunk")
		totalWritten += n
		if err != nil {
			eventLogger.Error().Stack().Err(err).Msg("write")
			transport.errChan <- err
			return err
		}
	}

	eventLogger.Info().Msg("sent")
	return nil
}

// handleFileWrite writes a file through tftp to the blcu
func (transport *Transport) handleFileWrite(message FileWriteMessage) error {
	_, err := transport.tftp.WriteFile(message.Filename(), tftp.BinaryMode, message)
	if err != nil {
		transport.errChan <- err
	}
	return err
}

// handleFileRead reads a file through tftp from the blcu
func (transport *Transport) handleFileRead(message FileReadMessage) error {
	_, err := transport.tftp.ReadFile(message.Filename(), tftp.BinaryMode, message)
	if err != nil {
		transport.errChan <- err
	}
	return err
}

// HandleSniffer starts listening for packets on the provided sniffer and handles them.
//
// This function will block until the sniffer is closed
func (transport *Transport) HandleSniffer(sniffer *sniffer.Sniffer) {
	demux, errChan := session.NewSnifferDemux(transport.handleConversation, transport.logger)
	go demux.ReadPackets(sniffer)
	for err := range errChan {
		transport.errChan <- err
	}
}

// HandleUDPServer starts listening for packets on the provided UDP server and handles them.
//
// This function will block until the server is closed
func (transport *Transport) HandleUDPServer(server *udp.Server) {
	packetsCh := server.GetPackets()
	errorsCh := server.GetErrors()
	
	for {
		select {
		case packet := <-packetsCh:
			transport.handleUDPPacket(packet)
		case err := <-errorsCh:
			transport.errChan <- err
		}
	}
}

// handleUDPPacket handles a single UDP packet received by the UDP server
func (transport *Transport) handleUDPPacket(udpPacket udp.Packet) {
	srcAddr := fmt.Sprintf("%s:%d", udpPacket.SourceIP, udpPacket.SourcePort)
	dstAddr := fmt.Sprintf("%s:%d", udpPacket.DestIP, udpPacket.DestPort)
	
	// Create a reader from the payload
	reader := bytes.NewReader(udpPacket.Payload)
	
	// Decode the packet
	packet, err := transport.decoder.DecodeNext(reader)
	if err != nil {
		transport.logger.Error().
			Str("from", srcAddr).
			Str("to", dstAddr).
			Err(err).
			Msg("failed to decode UDP packet")
		transport.errChan <- err
		return
	}
	
	// Intercept packets with id == 0 and replicate
	if transport.propagateFault && packet.Id() == 0 {
		transport.logger.Info().Msg("replicating packet with id 0 to all boards")
		err := transport.handlePacketEvent(NewPacketMessage(packet))
		if err != nil {
			transport.logger.Error().Err(err).Msg("failed to replicate packet")
		}
	}
	
	// Send notification
	transport.api.Notification(NewPacketNotification(packet, srcAddr, dstAddr, udpPacket.Timestamp))
}

// handleConversation is called when the sniffer detects a new conversation and handles its specific packets
func (transport *Transport) handleConversation(socket network.Socket, reader io.Reader) {
	srcAddr := fmt.Sprintf("%s:%d", socket.SrcIP, socket.SrcPort)
	dstAddr := fmt.Sprintf("%s:%d", socket.DstIP, socket.DstPort)
	conversationLogger := transport.logger.With().Str("from", srcAddr).Str("to", dstAddr).Logger()
	go func() {
		for {
			packet, err := transport.decoder.DecodeNext(reader)
			if err != nil {
				conversationLogger.Error().Stack().Err(err).Msg("decode")
				transport.errChan <- err
				transport.SendFault()
				return
			}

			// Intercept packets with id == 0 and replicate
			if transport.propagateFault && packet.Id() == 0 {
				conversationLogger.Info().Msg("replicating packet with id 0 to all boards")
				err := transport.handlePacketEvent(NewPacketMessage(packet))
				if err != nil {
					conversationLogger.Error().Err(err).Msg("failed to replicate packet")
				}
			}

			transport.api.Notification(NewPacketNotification(packet, srcAddr, dstAddr, time.Now()))
		}
	}()
}

// SetAPI sets the API that the Transport will use
func (transport *Transport) SetAPI(api abstraction.TransportAPI) {
	transport.logger.Trace().Type("api", api).Msg("set api")
	transport.api = api
}

func (transport *Transport) consumeErrors() {
	for err := range transport.errChan {
		transport.api.Notification(NewErrorNotification(err))
	}
}

func (transport *Transport) SendFault() {
	err := transport.SendMessage(NewPacketMessage(data.NewPacket(0)))
	if err != nil {
		transport.errChan <- err
	}
}

func (transport *Transport) SetpropagateFault(enabled bool) {
	transport.propagateFault = enabled
}
