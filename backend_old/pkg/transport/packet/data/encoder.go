package data

import (
	"encoding/binary"
	"io"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// Encoder is the encoder for data packets. It uses the encoder defined on the value descriptor.
type Encoder struct {
	endianness      binary.ByteOrder
	idToDescription map[abstraction.PacketId]Descriptor
}

// TODO: improve constructor
// NewEncoder creates a new Encoder
func NewEncoder(endianness binary.ByteOrder) *Encoder {
	return &Encoder{
		endianness:      endianness,
		idToDescription: make(map[abstraction.PacketId]Descriptor),
	}
}

// SetDescriptor sets the descriptor for the given id
func (encoder *Encoder) SetDescriptor(id abstraction.PacketId, descriptor Descriptor) *Encoder {
	encoder.idToDescription[id] = descriptor
	return encoder
}

// Encode encodes the given packet to the output Writer, returning any errors it encounters
func (encoder *Encoder) Encode(packet abstraction.Packet, output io.Writer) error {
	data, ok := packet.(*Packet)
	if !ok {
		return ErrUnexpectedPacket{Packet: packet}
	}
	values := data.GetValues()

	descriptor, ok := encoder.idToDescription[data.Id()]
	if !ok {
		return ErrUnexpectedId{packet.Id()}
	}

	for _, valueDescriptor := range descriptor {
		value, ok := values[valueDescriptor.Name]
		if !ok {
			return ErrValueNotFound{Value: valueDescriptor, Packet: packet}
		}

		err := valueDescriptor.Encode(encoder.endianness, value, output)
		if err != nil {
			return err
		}
	}

	return nil
}
