package order

import (
	"encoding/binary"
	"io"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// TODO: make private
// DecodeAdd decodes the next stateOrderAdd request from the reader
func (decoder *Decoder) DecodeAdd(id abstraction.PacketId, reader io.Reader) (abstraction.Packet, error) {
	orders, err := decodeSlice[abstraction.PacketId](decoder.endianness, reader)
	return &Add{
		id:     id,
		orders: orders,
	}, err
}

// TODO: make private
// DecodeRemove decodes the next stateOrderRemove request from the reader
func (decoder *Decoder) DecodeRemove(id abstraction.PacketId, reader io.Reader) (abstraction.Packet, error) {
	orders, err := decodeSlice[abstraction.PacketId](decoder.endianness, reader)
	return &Remove{
		id:     id,
		orders: orders,
	}, err
}

// sliceLength represents the encoded length of an slice
type sliceLength uint16

// decodeSlice decodes the next slice from the reader
//
// to know the length of the slice, first the `sliceLength` is readed and used to read the rest of values
func decodeSlice[T any](endianness binary.ByteOrder, reader io.Reader) ([]T, error) {
	var length sliceLength
	err := binary.Read(reader, endianness, &length)
	if err != nil {
		return nil, err
	}

	slice := make([]T, length)
	err = binary.Read(reader, endianness, &slice)
	return slice, err
}
