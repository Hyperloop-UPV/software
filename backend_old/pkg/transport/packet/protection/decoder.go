package protection

import (
	"encoding/binary"
	"io"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// decodingMatrix is used to select the appropiate method for decoding a given protection.
var decodingMatrix = map[Type]map[Kind]func(io.Reader, binary.ByteOrder) (Data, error){
	IntType: {
		BelowKind:            decodeBelow[int32],
		AboveKind:            decodeAbove[int32],
		OutOfBoundsKind:      decodeOutOfBounds[int32],
		EqualsKind:           decodeEquals[int32],
		NotEqualsKind:        decodeNotEquals[int32],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[int32],
		WarningKind:          decodeWarning,
	},
	FloatType: {
		BelowKind:            decodeBelow[float32],
		AboveKind:            decodeAbove[float32],
		OutOfBoundsKind:      decodeOutOfBounds[float32],
		EqualsKind:           decodeEquals[float32],
		NotEqualsKind:        decodeNotEquals[float32],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[float32],
		WarningKind:          decodeWarning,
	},
	DoubleType: {
		BelowKind:            decodeBelow[float64],
		AboveKind:            decodeAbove[float64],
		OutOfBoundsKind:      decodeOutOfBounds[float64],
		EqualsKind:           decodeEquals[float64],
		NotEqualsKind:        decodeNotEquals[float64],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[float64],
		WarningKind:          decodeWarning,
	},
	CharType: {
		BelowKind:            decodeBelow[byte],
		AboveKind:            decodeAbove[byte],
		OutOfBoundsKind:      decodeOutOfBounds[byte],
		EqualsKind:           decodeEquals[byte],
		NotEqualsKind:        decodeNotEquals[byte],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[byte],
		WarningKind:          decodeWarning,
	},
	BoolType: {
		BelowKind:            decodeBelow[bool],
		AboveKind:            decodeAbove[bool],
		OutOfBoundsKind:      decodeOutOfBounds[bool],
		EqualsKind:           decodeEquals[bool],
		NotEqualsKind:        decodeNotEquals[bool],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[bool],
		WarningKind:          decodeWarning,
	},
	ShortType: {
		BelowKind:            decodeBelow[int16],
		AboveKind:            decodeAbove[int16],
		OutOfBoundsKind:      decodeOutOfBounds[int16],
		EqualsKind:           decodeEquals[int16],
		NotEqualsKind:        decodeNotEquals[int16],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[int16],
		WarningKind:          decodeWarning,
	},
	LongType: {
		BelowKind:            decodeBelow[int64],
		AboveKind:            decodeAbove[int64],
		OutOfBoundsKind:      decodeOutOfBounds[int64],
		EqualsKind:           decodeEquals[int64],
		NotEqualsKind:        decodeNotEquals[int64],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[int64],
		WarningKind:          decodeWarning,
	},
	Uint8Type: {
		BelowKind:            decodeBelow[uint8],
		AboveKind:            decodeAbove[uint8],
		OutOfBoundsKind:      decodeOutOfBounds[uint8],
		EqualsKind:           decodeEquals[uint8],
		NotEqualsKind:        decodeNotEquals[uint8],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[uint8],
		WarningKind:          decodeWarning,
	},
	Uint16Type: {
		BelowKind:            decodeBelow[uint16],
		AboveKind:            decodeAbove[uint16],
		OutOfBoundsKind:      decodeOutOfBounds[uint16],
		EqualsKind:           decodeEquals[uint16],
		NotEqualsKind:        decodeNotEquals[uint16],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[uint16],
		WarningKind:          decodeWarning,
	},
	Uint32Type: {
		BelowKind:            decodeBelow[uint32],
		AboveKind:            decodeAbove[uint32],
		OutOfBoundsKind:      decodeOutOfBounds[uint32],
		EqualsKind:           decodeEquals[uint32],
		NotEqualsKind:        decodeNotEquals[uint32],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[uint32],
		WarningKind:          decodeWarning,
	},
	Uint64Type: {
		BelowKind:            decodeBelow[uint64],
		AboveKind:            decodeAbove[uint64],
		OutOfBoundsKind:      decodeOutOfBounds[uint64],
		EqualsKind:           decodeEquals[uint64],
		NotEqualsKind:        decodeNotEquals[uint64],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[uint64],
		WarningKind:          decodeWarning,
	},
	Int8Type: {
		BelowKind:            decodeBelow[int8],
		AboveKind:            decodeAbove[int8],
		OutOfBoundsKind:      decodeOutOfBounds[int8],
		EqualsKind:           decodeEquals[int8],
		NotEqualsKind:        decodeNotEquals[int8],
		ErrorHandlerKind:     decodeErrorHandler,
		TimeAccumulationKind: decodeTimeAccumulation[int8],
		WarningKind:          decodeWarning,
	},
}

// Decoder is a protection packet decoder.
type Decoder struct {
	endianness   binary.ByteOrder
	idToSeverity map[abstraction.PacketId]Severity
}

func NewDecoder(endianess binary.ByteOrder) *Decoder {
	return &Decoder{
		endianness:   endianess,
		idToSeverity: make(map[abstraction.PacketId]Severity),
	}
}

// SetSeverity sets the severity of the packet with the given id.
//
// Packets with no known severity will return an error.
//
// Returns the same decoder to allow chaining.
func (decoder *Decoder) SetSeverity(id abstraction.PacketId, severity Severity) *Decoder {
	decoder.idToSeverity[id] = severity
	return decoder
}

func (decoder *Decoder) Decode(id abstraction.PacketId, reader io.Reader) (abstraction.Packet, error) {
	severity, ok := decoder.idToSeverity[id]
	if !ok {
		return nil, ErrUnexpectedId{Id: id}
	}

	packet := NewPacket(id, severity)

	err := binary.Read(reader, decoder.endianness, &packet.Type)
	if err != nil {
		return packet, err
	}

	err = binary.Read(reader, decoder.endianness, &packet.Kind)
	if err != nil {
		return packet, err
	}

	packet.Name, err = readCString(reader)
	if err != nil {
		return packet, err
	}

	dataDecoderRow, ok := decodingMatrix[packet.Type]
	if !ok {
		return packet, ErrUnexpectedType{Type: packet.Type}
	}

	dataDecoder, ok := dataDecoderRow[packet.Kind]
	if !ok {
		return packet, ErrUnexpectedKind{Kind: packet.Kind}
	}

	packet.Data, err = dataDecoder(reader, decoder.endianness)
	if err != nil {
		return packet, err
	}

	packet.Timestamp, err = decodeTimestamp(reader, decoder.endianness)
	return packet, err
}

// readCString reads a null-terminated string from the reader.
func readCString(reader io.Reader) (string, error) {
	data := make([]byte, 0)
	read := make([]byte, 1)
	var err error
	var n int
	for {
		n, err = reader.Read(read)
		if n < 1 || err != nil || read[0] == 0 {
			break
		}
		data = append(data, read[0])
	}
	return string(data), err
}
