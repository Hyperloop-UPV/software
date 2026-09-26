package order

import (
	"encoding/binary"
	"io"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// actionDecoder is a decoder for a stateOrder action
type actionDecoder func(id abstraction.PacketId, reader io.Reader) (abstraction.Packet, error)

// Decoder decodes the state order actions
type Decoder struct {
	idToAction map[abstraction.PacketId]actionDecoder
	endianness binary.ByteOrder
}

// TODO: improve constructor
// NewDecoder creates a new Decoder
func NewDecoder(endianness binary.ByteOrder) *Decoder {
	return &Decoder{
		endianness: endianness,
		idToAction: make(map[abstraction.PacketId]actionDecoder),
	}
}

// SetActionId sets the action decoder for the specified id
func (decoder *Decoder) SetActionId(id abstraction.PacketId, action actionDecoder) {
	decoder.idToAction[id] = action
}

// Decode decodes the next state order action from the reader.
//
// it uses the id to determine the kind of action.
func (decoder *Decoder) Decode(id abstraction.PacketId, reader io.Reader) (abstraction.Packet, error) {
	dec, ok := decoder.idToAction[id]
	if !ok {
		return nil, ErrUnexpectedId{Id: id}
	}

	return dec(id, reader)
}
