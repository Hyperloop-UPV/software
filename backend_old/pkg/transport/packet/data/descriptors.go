package data

import (
	"encoding/binary"
	"io"
	"reflect"
)

// Descriptor describes the structure of a data packet as an array of values
type Descriptor []valueDescriptor

// valueDescriptor describes a value of a packet
type valueDescriptor struct {
	Name    ValueName
	Type    valueType
	decode  valueDecoder
	encode  valueEncoder
	convert valueConverter
	revert  valueReverter
}

// Decode decodes the next value from the reader using its decoding method
func (descriptor *valueDescriptor) Decode(endianness binary.ByteOrder, reader io.Reader) (Value, error) {
	value, err := descriptor.decode(endianness, reader)
	if err != nil {
		return value, err
	}
	return descriptor.convert(value), nil
}

// Encode encodes the provided value into the writer using its encoding method
func (descriptor *valueDescriptor) Encode(endianness binary.ByteOrder, value Value, writer io.Writer) error {
	return descriptor.encode(endianness, descriptor.revert(value), writer)
}

// NewNumericDescriptor creates a new NumericDescriptor
//
// name is the name for the value
func NewNumericDescriptor[N numeric](name ValueName, podUnits, displayUnits ConversionDescriptor) valueDescriptor {
	var n N
	return valueDescriptor{
		Name:    name,
		Type:    valueType(reflect.TypeOf(n).Name()),
		decode:  decodeNumeric[N],
		encode:  encodeNumeric[N],
		convert: newConvertNumeric[N](podUnits, displayUnits),
		revert:  newRevertNumeric[N](podUnits, displayUnits),
	}
}

// NewBooleanDescriptor creates a new BooleanDescriptor
//
// name is the name for the value
func NewBooleanDescriptor(name ValueName) valueDescriptor {
	return valueDescriptor{
		Name:    name,
		Type:    BoolType,
		decode:  decodeBool,
		encode:  encodeBool,
		convert: convertBoolean,
		revert:  revertBoolean,
	}
}

// NewEnumDescriptor creates a new EnumDescriptor
//
// name is the name for the value and descriptor is the variants the enum has
func NewEnumDescriptor(name ValueName, descriptor EnumDescriptor) valueDescriptor {
	return valueDescriptor{
		Name:    name,
		Type:    EnumType,
		decode:  newDecodeEnum(name, descriptor),
		encode:  newEncodeEnum(name, descriptor),
		convert: convertEnum,
		revert:  revertEnum,
	}
}
