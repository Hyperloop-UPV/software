package presentation

import (
	"encoding/binary"
	"io"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/blcu"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/protection"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/state"
	"github.com/rs/zerolog"
)

// PacketDecoder is a common interface for packet-specific decoders
type PacketDecoder interface {
	Decode(id abstraction.PacketId, reader io.Reader) (abstraction.Packet, error)
}

// Type assertions to check packet decoders follows the Decoder interface
var _ PacketDecoder = &data.Decoder{}
var _ PacketDecoder = &blcu.Decoder{}
var _ PacketDecoder = &order.Decoder{}
var _ PacketDecoder = &protection.Decoder{}
var _ PacketDecoder = &state.Decoder{}

// Decoder is the root decoder, it takes the id of the packet and decodes the rest of it
type Decoder struct {
	idToDecoder map[abstraction.PacketId]PacketDecoder
	endianness  binary.ByteOrder

	logger zerolog.Logger
}

// TODO: improve constructor
// NewDecoder creates a new decoder with the given endianness
func NewDecoder(endianness binary.ByteOrder, baseLogger zerolog.Logger) *Decoder {
	logger := baseLogger.Sample(zerolog.LevelSampler{
		TraceSampler: zerolog.RandomSampler(1),
		DebugSampler: zerolog.RandomSampler(25000),
		InfoSampler:  zerolog.RandomSampler(1),
		WarnSampler:  zerolog.RandomSampler(1),
		ErrorSampler: zerolog.RandomSampler(1),
	})

	return &Decoder{
		idToDecoder: make(map[abstraction.PacketId]PacketDecoder),
		endianness:  endianness,

		logger: logger,
	}
}

// SetPacketDecoder sets the decoder for the specified id
func (decoder *Decoder) SetPacketDecoder(id abstraction.PacketId, dec PacketDecoder) {
	decoder.idToDecoder[id] = dec
	decoder.logger.Trace().Uint16("id", uint16(id)).Type("decoder", dec).Msg("set decoder")
}

// DecodeNext reads and decodes the next packet from the input stream, returning any errors encountered
//
// the decoder should have all the id decoders set before calling DecodeNext
func (decoder *Decoder) DecodeNext(reader io.Reader) (abstraction.Packet, error) {
	var id abstraction.PacketId
	err := binary.Read(reader, decoder.endianness, &id)
	if err != nil {
		decoder.logger.Error().Stack().Err(err).Msg("read")
		return nil, err
	}

	dec, ok := decoder.idToDecoder[id]
	if !ok {
		decoder.logger.Warn().Uint16("id", uint16(id)).Msg("no decoder set")
		err := ErrUnexpectedId{Id: id}
		return nil, err
	}

	decoder.logger.Debug().Uint16("id", uint16(id)).Type("decoder", dec).Msg("decoding")
	packet, err := dec.Decode(id, reader)

	return packet, err
}
