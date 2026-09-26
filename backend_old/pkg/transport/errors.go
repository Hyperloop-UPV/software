package transport

import (
	"fmt"
	"net"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// ErrUnrecognizedEvent is returned when the event passed to transport
// has an invalid type or it is not recognized.
type ErrUnrecognizedEvent struct {
	Event abstraction.TransportEvent
}

func (err ErrUnrecognizedEvent) Error() string {
	return fmt.Sprintf("unrecognized event %s", err.Event)
}

type ErrTargetAlreadyConnected struct {
	Target abstraction.TransportTarget
}

func (err ErrTargetAlreadyConnected) Error() string {
	return fmt.Sprintf("%s is already connected", err.Target)
}

type ErrUnrecognizedId struct {
	Id abstraction.PacketId
}

func (err ErrUnrecognizedId) Error() string {
	return fmt.Sprintf("could not find target for packet with id %d", err.Id)
}

type ErrConnClosed struct {
	Target abstraction.TransportTarget
}

func (err ErrConnClosed) Error() string {
	return fmt.Sprintf("connection with %s is closed", err.Target)
}

type ErrUnknownTarget struct {
	Remote net.Addr
}

func (err ErrUnknownTarget) Error() string {
	return fmt.Sprintf("unknown target for %s", err.Remote)
}
