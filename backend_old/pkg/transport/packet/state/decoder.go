package state

import (
	"encoding/binary"
	"io"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// Decoder decodes state space messages
type Decoder struct {
	endianness binary.ByteOrder
}

// NewDecoder creates a new Decoder
func NewDecoder(endianness binary.ByteOrder) *Decoder {
	return &Decoder{
		endianness: endianness,
	}
}

// Decode decodes the next state space message in the stream
func (decoder *Decoder) Decode(id abstraction.PacketId, reader io.Reader) (abstraction.Packet, error) {
	stateSpace := Space{
		id: id,
	}

	err := binary.Read(reader, decoder.endianness, &stateSpace.state)
	return &stateSpace, err
}
