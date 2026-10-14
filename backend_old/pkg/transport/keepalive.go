package transport

import (
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
)

// KeepAliveId is the packet id of the empty order used as the
// application-level TCP keep-alive.
const KeepAliveId abstraction.PacketId = 1

// DefaultKeepAliveInterval is how often the keep-alive order is sent to each
// board when no interval is configured.
const DefaultKeepAliveInterval = 50 * time.Millisecond

// HandleKeepAlive broadcasts an empty order with id KeepAliveId to every
// connected board every interval. Write errors are forwarded to the
// connection handler by the connection wrapper, which tears the connection
// down. This method blocks.
func (transport *Transport) HandleKeepAlive(interval time.Duration) {
	if interval <= 0 {
		interval = DefaultKeepAliveInterval
	}
	// The keep-alive frame never changes, so encode it once up front
	buf, err := transport.encoder.Encode(data.NewPacket(KeepAliveId))
	if err != nil {
		transport.logger.Error().Stack().Err(err).Msg("encode keep-alive")
		transport.errChan <- err
		return
	}
	frame := make([]byte, buf.Len())
	copy(frame, buf.Bytes())
	transport.encoder.ReleaseBuffer(buf)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		transport.broadcastKeepAlive(frame, interval)
	}
}

// broadcastKeepAlive writes the keep-alive frame to all active connections.
func (transport *Transport) broadcastKeepAlive(frame []byte, interval time.Duration) {
	transport.connectionsMx.RLock()
	defer transport.connectionsMx.RUnlock()

	for target, conn := range transport.connections {
		// Bound the write so a dead peer with a full send buffer cannot hold
		// the connections lock past the next tick
		conn.SetWriteDeadline(time.Now().Add(interval))
		totalWritten := 0
		for totalWritten < len(frame) {
			n, err := conn.Write(frame[totalWritten:])
			totalWritten += n
			if err != nil {
				// net.ErrClosed means the connection was closed on purpose
				// and its handler already reported the reason
				if !errors.Is(err, net.ErrClosed) {
					transport.logger.Error().Stack().Err(err).Str("target", string(target)).Msg("keep-alive write")
					transport.errChan <- fmt.Errorf("TCP keep-alive to board %s failed: %w", target, err)
				}
				break
			}
		}
		conn.SetWriteDeadline(time.Time{})
	}
}
