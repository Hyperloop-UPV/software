package udp

import (
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

type Packet struct {
	SourceIP   net.IP
	SourcePort uint16
	DestIP     net.IP
	DestPort   uint16
	Payload    []byte
	Timestamp  time.Time
}

type Server struct {
	address   string
	port      uint16
	conn      *net.UDPConn
	logger    *zerolog.Logger
	packetsCh chan Packet
	errorsCh  chan error
	stopCh    chan struct{}
	stopped   bool

	ring      []Packet
	head      int
	tail      int
	count     int
	ringMutex sync.Mutex
	notEmpty  *sync.Cond

	// Disabled: state for the UDP keep-alive, which checked that every source
	// IP kept sending packets and reported disconnections - Javier Ribal del Río (2026-07-15)
	// lastSeen               map[string]time.Time
	// lastSeenMu             sync.Mutex
	// keepAliveCheckInterval time.Duration
	// keepAliveTimeout       time.Duration
	// OnDisconnect           func(ip string)
}

// Disabled: default intervals for the UDP keep-alive - Javier Ribal del Río (2026-07-15)
// const (
// 	defaultKeepAliveCheckInterval = 5 * time.Millisecond
// 	defaultKeepAliveTimeout       = 100 * time.Millisecond
// )

func NewServer(address string, port uint16, logger *zerolog.Logger, ringBufferSize int, packetChanSize int) *Server {
	// Disabled: UDP keep-alive parameters and their defaulting; the previous
	// signature also took keepAliveCheckInterval, keepAliveTimeout and an
	// onDisconnect callback - Javier Ribal del Río (2026-07-15)
	// if keepAliveCheckInterval <= 0 {
	// 	keepAliveCheckInterval = defaultKeepAliveCheckInterval
	// }
	// if keepAliveTimeout <= 0 {
	// 	keepAliveTimeout = defaultKeepAliveTimeout
	// }

	s := &Server{
		address:   address,
		port:      port,
		logger:    logger,
		packetsCh: make(chan Packet, packetChanSize),
		errorsCh:  make(chan error, 100),
		stopCh:    make(chan struct{}),
		// Disabled: UDP keep-alive state initialization - Javier Ribal del Río (2026-07-15)
		// lastSeen:               make(map[string]time.Time),
		// keepAliveCheckInterval: keepAliveCheckInterval,
		// keepAliveTimeout:       keepAliveTimeout,
		// OnDisconnect:           onDisconnect,
	}

	s.ring = make([]Packet, ringBufferSize)
	s.head = 0
	s.tail = 0
	s.count = 0
	s.notEmpty = sync.NewCond(&s.ringMutex)
	return s
}

func (s *Server) Start() error {
	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", s.address, s.port))
	if err != nil {
		return fmt.Errorf("failed to resolve UDP address: %w", err)
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return fmt.Errorf("failed to listen on UDP: %w", err)
	}
	s.conn = conn

	s.logger.Info().
		Str("address", s.address).
		Uint16("port", s.port).
		Msg("UDP server started")

	go s.readLoop()     // Read incoming UDP packets
	go s.dispatchLoop() // Dispatch packets from ring buffer to channel
	// Disabled: goroutine that monitored UDP keep-alive timeouts - Javier Ribal del Río (2026-07-15)
	// go s.keepAliveLoop()
	return nil
}

func (s *Server) readLoop() {
	buffer := make([]byte, 65535) // Maximum UDP packet size

	for {
		select {
		case <-s.stopCh:
			return
		default:
			// Set read deadline to allow periodic checking of stop channel
			s.conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))

			n, addr, err := s.conn.ReadFromUDP(buffer)
			if err != nil {
				// Check if it's a timeout error (expected)
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					continue
				}
				s.logger.Error().Err(err).Msg("failed to read UDP packet")
				select {
				case s.errorsCh <- err:
				default:
					// Error channel full, drop error
				}
				continue
			}

			// Create a copy of the packet data
			payload := make([]byte, n)
			copy(payload, buffer[:n])

			packet := Packet{
				SourceIP:   addr.IP,
				SourcePort: uint16(addr.Port),
				DestIP:     net.ParseIP(s.address),
				DestPort:   s.port,
				Payload:    payload,
				Timestamp:  time.Now(),
			}

			s.logger.Debug().
				Str("source", fmt.Sprintf("%s:%d", packet.SourceIP, packet.SourcePort)).
				Str("dest", fmt.Sprintf("%s:%d", packet.DestIP, packet.DestPort)).
				Int("size", len(payload)).
				Msg("received UDP packet")

			// Disabled: recorded when each source IP was last seen, feeding
			// the UDP keep-alive check - Javier Ribal del Río (2026-07-15)
			// s.lastSeenMu.Lock()
			// s.lastSeen[addr.IP.String()] = packet.Timestamp
			// s.lastSeenMu.Unlock()

			// Push packet to ring buffer
			s.push(packet)
		}
	}
}

// Disabled: UDP keep-alive loop — checked every keepAliveCheckInterval whether
// any source IP had gone more than keepAliveTimeout without sending a packet,
// and fired OnDisconnect for it - Javier Ribal del Río (2026-07-15)
// func (s *Server) keepAliveLoop() {
// 	ticker := time.NewTicker(s.keepAliveCheckInterval)
// 	defer ticker.Stop()
//
// 	for {
// 		select {
// 		case <-s.stopCh:
// 			return
// 		case now := <-ticker.C:
// 			var timedOut []string
//
// 			s.lastSeenMu.Lock()
// 			for ip, last := range s.lastSeen {
// 				if now.Sub(last) > s.keepAliveTimeout {
// 					timedOut = append(timedOut, ip)
// 					delete(s.lastSeen, ip)
// 				}
// 			}
// 			s.lastSeenMu.Unlock()
//
// 			for _, ip := range timedOut {
// 				s.logger.Error().
// 					Str("ip", ip).
// 					Dur("timeout", s.keepAliveTimeout).
// 					Msg("keep-alive timeout: no UDP packets received")
// 				if s.OnDisconnect != nil {
// 					// Run the callback on its own goroutine so a slow
// 					// handler (e.g. blocking TCP writes) cannot stall
// 					// timeout detection for the remaining IPs
// 					go s.OnDisconnect(ip)
// 				}
// 			}
// 		}
// 	}
// }

func (s *Server) GetPackets() <-chan Packet {
	return s.packetsCh
}

func (s *Server) GetErrors() <-chan error {
	return s.errorsCh
}

func (s *Server) Stop() error {
	s.ringMutex.Lock()
	s.stopped = true
	close(s.stopCh)
	s.notEmpty.Broadcast() // despertar a los que esperan
	s.ringMutex.Unlock()

	if s.conn != nil {
		return s.conn.Close()
	}
	return nil
}

func (s *Server) push(p Packet) {

	s.ringMutex.Lock()
	defer s.ringMutex.Unlock()

	if s.count == len(s.ring) {
		s.logger.Debug().Msg("Ring buffer full, overwriting oldest UDP packet")
		s.head = (s.head + 1) % len(s.ring)
		s.count--
	}

	s.ring[s.tail] = p
	s.tail = (s.tail + 1) % len(s.ring)
	s.count++

	s.notEmpty.Signal()
}

func (s *Server) pop() (Packet, bool) {

	s.ringMutex.Lock()
	defer s.ringMutex.Unlock()

	for s.count == 0 && !s.stopped {
		s.notEmpty.Wait()
	}

	if s.count == 0 && s.stopped {
		return Packet{}, false
	}

	p := s.ring[s.head]
	s.head = (s.head + 1) % len(s.ring)
	s.count--

	return p, true
}

func (s *Server) dispatchLoop() {
	for {
		select {
		case <-s.stopCh:
			return
		default:
		}

		packet, ok := s.pop()
		if !ok {
			return
		}

		select {
		case s.packetsCh <- packet:
		case <-s.stopCh:
			return
		}
	}
}
