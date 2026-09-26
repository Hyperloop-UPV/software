package data

import (
	"encoding/json"
	"sync"
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

var packetPool = sync.Pool{
	New: func() any {
		return &Packet{
			values:  make(map[ValueName]Value),
			enabled: make(map[ValueName]bool),
		}
	},
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

// numericValuer is implemented by NumericValue[N] for any numeric N.
type numericValuer interface {
	Value() float64
}

// GetValuesAsJSON returns the values of the packet as a JSON object
func (packet *Packet) GetValuesAsJSON() ([]byte, error) {
	out := make(map[string]any, len(packet.values))

	for k, v := range packet.values {
		switch x := v.(type) {
		case BooleanValue:
			out[string(k)] = x.Value()
		case EnumValue:
			out[string(k)] = string(x.Variant())
		default:
			if nv, ok := v.(numericValuer); ok {
				out[string(k)] = nv.Value()
			} else {
				out[string(k)] = nil
			}
		}
	}

	return json.Marshal(out)
}

// SetTimestamp sets the timestamp of the packet to the given time
func (packet *Packet) SetTimestamp(timestamp time.Time) *Packet {
	packet.timestamp = timestamp
	return packet
}

func (packet *Packet) Reset() {
	clear(packet.values)
	clear(packet.enabled)
	packet.id = 0
	packet.timestamp = time.Time{}
}

func GetPacket(id abstraction.PacketId) *Packet {
	p := packetPool.Get().(*Packet)
	if p.values == nil {
		p.values = make(map[ValueName]Value)
	} else {
		clear(p.values)
	}
	if p.enabled == nil {
		p.enabled = make(map[ValueName]bool)
	} else {
		clear(p.enabled)
	}
	p.id = id
	p.timestamp = time.Now()
	return p
}

func ReleasePacket(p *Packet) {
	if p == nil {
		return
	}
	p.Reset()
	packetPool.Put(p)
}
