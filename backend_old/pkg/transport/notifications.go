package transport

import (
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// PacketNotification notifies of an incoming message
type PacketNotification struct {
	Packet    abstraction.Packet
	From      string
	To        string
	Timestamp time.Time
}

func NewPacketNotification(packet abstraction.Packet, from string, to string, timestamp time.Time) PacketNotification {
	return PacketNotification{
		Packet:    packet,
		From:      from,
		To:        to,
		Timestamp: timestamp,
	}
}

// Event always returns PacketEvent
func (notification PacketNotification) Event() abstraction.TransportEvent {
	return PacketEvent
}

// ErrorNotification notifies of an error that arised
type ErrorNotification struct {
	Err error
}

func NewErrorNotification(err error) ErrorNotification {
	return ErrorNotification{
		Err: err,
	}
}

func (notification ErrorNotification) Event() abstraction.TransportEvent {
	return ErrorEvent
}
