package presentation

import (
	"bytes"
	"encoding/binary"
	"io"
	"sync"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/rs/zerolog"
)

type PacketEncoder interface {
	Encode(abstraction.Packet, io.Writer) error
}

type Encoder struct {
	idToEncoder map[abstraction.PacketId]PacketEncoder
	endianness  binary.ByteOrder

	logger  zerolog.Logger
	bufPool sync.Pool
}

// TODO: improve constructor
// NewEncoder creates a new encoder with the given endianness
func NewEncoder(endianness binary.ByteOrder, baseLogger zerolog.Logger) *Encoder {
	return &Encoder{
		idToEncoder: make(map[abstraction.PacketId]PacketEncoder),
		endianness:  endianness,

		logger: baseLogger,
		bufPool: sync.Pool{
			New: func() any { return new(bytes.Buffer) },
		},
	}
}

// SetPacketEncoder sets the encoder for the specified id
func (encoder *Encoder) SetPacketEncoder(id abstraction.PacketId, enc PacketEncoder) {
	encoder.idToEncoder[id] = enc
	encoder.logger.Trace().Uint16("id", uint16(id)).Type("encoder", enc).Msg("set encoder")
}

// Encode encodes the provided packet into a pooled buffer. Callers must release
// the buffer via ReleaseBuffer once they are done using the returned data.
func (encoder *Encoder) Encode(packet abstraction.Packet) (*bytes.Buffer, error) {
	enc, ok := encoder.idToEncoder[packet.Id()]
	if !ok {
		encoder.logger.Warn().Uint16("id", uint16(packet.Id())).Msg("no encoder set")
		return nil, ErrUnexpectedId{Id: packet.Id()}
	}

	bufferAny := encoder.bufPool.Get()
	buffer := bufferAny.(*bytes.Buffer)
	buffer.Reset()

	err := binary.Write(buffer, encoder.endianness, packet.Id())
	if err != nil {
		encoder.logger.Error().Stack().Err(err).Uint16("id", uint16(packet.Id())).Msg("buffering id")
		encoder.ReleaseBuffer(buffer)
		return nil, err
	}

	encoder.logger.Debug().Uint16("id", uint16(packet.Id())).Type("encoder", enc).Msg("encoding")
	err = enc.Encode(packet, buffer)
	if err != nil {
		encoder.ReleaseBuffer(buffer)
		return nil, err
	}

	return buffer, nil
}

// ReleaseBuffer returns a buffer obtained from Encode back to the pool.
func (encoder *Encoder) ReleaseBuffer(buffer *bytes.Buffer) {
	if buffer == nil {
		return
	}
	buffer.Reset()
	encoder.bufPool.Put(buffer)
}
