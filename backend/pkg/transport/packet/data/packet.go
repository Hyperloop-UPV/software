package data

import (
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// Type assertion to check Data follows the abstraction.Packet interface
var _ abstraction.Packet = &Packet{}

// Packet is a data packet containing multiple values
type Packet struct {
	id        abstraction.PacketId
	values    map[ValueName]Value
	enabled   map[ValueName]bool
	timestamp time.Time
}

// NewPacket creates a new data packet
func NewPacket(id abstraction.PacketId) *Packet {
	return &Packet{
		id:        id,
		values:    make(map[ValueName]Value),
		enabled:   make(map[ValueName]bool),
		timestamp: time.Now(),
	}
}

// NewPacketWithValues creates a new data packet with the given values
func NewPacketWithValues(id abstraction.PacketId, values map[ValueName]Value, enabled map[ValueName]bool) *Packet {
	return &Packet{
		id:        id,
		values:    values,
		enabled:   enabled,
		timestamp: time.Now(),
	}
}

// Id returns the id of the data packet
func (packet *Packet) Id() abstraction.PacketId {
	return packet.id
}

func (packet *Packet) Timestamp() time.Time {
	return packet.timestamp
}

// SetValue updates the value with the given name to the new value. It overwrites a value if it is already set
func (packet *Packet) SetValue(name ValueName, value Value, enable bool) *Packet {
	packet.values[name] = value
	packet.enabled[name] = enable
	return packet
}

// GetValues returns all values associated with the packet
func (packet *Packet) GetValues() map[ValueName]Value {
	return packet.values
}

func (packet *Packet) SetTimestamp(timestamp time.Time) *Packet {
	packet.timestamp = timestamp
	return packet
}
