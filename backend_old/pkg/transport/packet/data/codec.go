package data

import (
	"encoding/binary"
	"io"
)

// valueDecoder is a function that tells how a value should be decoded based on its type
type valueDecoder func(endianness binary.ByteOrder, reader io.Reader) (Value, error)

// valueEncoder is a function that tells how a value should be encoded based on its type
type valueEncoder func(endianness binary.ByteOrder, value Value, writer io.Writer) error

// type assertions to check all variants of decodeNumeric are valueDecoders
var _ valueDecoder = decodeNumeric[uint8]
var _ valueDecoder = decodeNumeric[uint16]
var _ valueDecoder = decodeNumeric[uint32]
var _ valueDecoder = decodeNumeric[uint64]
var _ valueDecoder = decodeNumeric[int8]
var _ valueDecoder = decodeNumeric[int16]
var _ valueDecoder = decodeNumeric[int32]
var _ valueDecoder = decodeNumeric[int64]
var _ valueDecoder = decodeNumeric[float32]
var _ valueDecoder = decodeNumeric[float64]

// decodeNumeric decodes the next numeric value based on the provided type
func decodeNumeric[N numeric](endianness binary.ByteOrder, reader io.Reader) (Value, error) {
	var val N
	err := binary.Read(reader, endianness, &val)
	return NewNumericValue[N](val), err
}

// type assertions to check all variants of encodeNumeric are valueEncoders
var _ valueEncoder = encodeNumeric[uint8]
var _ valueEncoder = encodeNumeric[uint16]
var _ valueEncoder = encodeNumeric[uint32]
var _ valueEncoder = encodeNumeric[uint64]
var _ valueEncoder = encodeNumeric[int8]
var _ valueEncoder = encodeNumeric[int16]
var _ valueEncoder = encodeNumeric[int32]
var _ valueEncoder = encodeNumeric[int64]
var _ valueEncoder = encodeNumeric[float32]
var _ valueEncoder = encodeNumeric[float64]

// encodeNumeric encodes the numeric value into the provided writer
func encodeNumeric[N numeric](endianness binary.ByteOrder, value Value, writer io.Writer) error {
	num, ok := value.(NumericValue[N])
	if !ok {
		return ErrMismatchedTypes{Value: value}
	}
	return binary.Write(writer, endianness, num.inner)
}

// type assertion to check decodeBool follows valueDecoder
var _ valueDecoder = decodeBool

// decodeBool decodes the next boolean value
func decodeBool(endianness binary.ByteOrder, reader io.Reader) (Value, error) {
	var val bool
	err := binary.Read(reader, endianness, &val)
	return NewBooleanValue(val), err
}

// type assertion to check encodeBool follows valueEncoder
var _ valueEncoder = encodeBool

// encodeBool encodes the provided value as a boolean into the writer
func encodeBool(endianness binary.ByteOrder, value Value, writer io.Writer) error {
	boolean, ok := value.(BooleanValue)
	if !ok {
		return ErrMismatchedTypes{Value: value}
	}
	return binary.Write(writer, endianness, boolean.inner)
}

// newDecodeEnum creates a new enum decoder for the given EnumDescriptor and name
func newDecodeEnum(name ValueName, descriptor EnumDescriptor) valueDecoder {
	return func(endianness binary.ByteOrder, reader io.Reader) (Value, error) {
		var variant uint8
		err := binary.Read(reader, endianness, &variant)
		if err != nil {
			return nil, err
		}
		variantIdx := int(variant)

		if variantIdx >= len(descriptor) {
			return nil, ErrInvalidVariant{Name: name, Idx: variantIdx, Len: len(descriptor)}
		}

		return NewEnumValue(descriptor[variantIdx]), nil
	}
}

// newEncodeEnum creates a new enum encoder for the given EnumDescriptor and name
func newEncodeEnum(name ValueName, descriptor EnumDescriptor) valueEncoder {
	return func(endianness binary.ByteOrder, value Value, writer io.Writer) error {
		enum, ok := value.(EnumValue)
		if !ok {
			return ErrMismatchedTypes{Value: value}
		}

		variantIdx := -1
		for i, variant := range descriptor {
			if variant == enum.Variant() {
				variantIdx = i
			}
		}
		if variantIdx < 0 {
			return ErrUnexpectedVariant{Name: name, Variant: enum.Variant(), Descriptor: descriptor}
		}

		return binary.Write(writer, endianness, uint8(variantIdx))
	}
}
