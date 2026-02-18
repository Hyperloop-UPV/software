package blcu

import (
	"io"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// Decoder is a decoder for the blcu Ack packet
type Decoder struct{}

// NewDecoder creates a new Decoder
func NewDecoder() *Decoder {
	return &Decoder{}
}

// Decode decodes the next packet on reader and returns the corresponding blcuAck.
func (decoder *Decoder) Decode(id abstraction.PacketId, reader io.Reader) (abstraction.Packet, error) {
	return NewAck(id), nil
}
