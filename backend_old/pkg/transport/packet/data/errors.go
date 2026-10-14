package data

import (
	"fmt"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// ErrUnexpectedId is returned when an ID is not recognized or is not defined
type ErrUnexpectedId struct {
	Id abstraction.PacketId
}

func (err ErrUnexpectedId) Error() string {
	return fmt.Sprintf("unexpected id %d", err.Id)
}

// ErrUnexpectedValue is returned when a codec is not found for a value
type ErrUnexpectedValue struct {
	Value valueDescriptor
}

func (err ErrUnexpectedValue) Error() string {
	return fmt.Sprintf("unexpected value %s with type %s", err.Value.Name, err.Value.Type)
}

// ErrUndefinedEnum is returned when an enum is not defined
type ErrUndefinedEnum struct {
	Name ValueName
}

func (err ErrUndefinedEnum) Error() string {
	return fmt.Sprintf("enum %s is not defined", err.Name)
}

// ErrInvalidVariant is returned when trying to access an invalid enum variant
type ErrInvalidVariant struct {
	Name ValueName
	Idx  int
	Len  int
}

func (err ErrInvalidVariant) Error() string {
	return fmt.Sprintf("enum %s has %d variants, but tried to access the %d variant", err.Name, err.Len, err.Idx+1)
}

// ErrUnexpectedPacket is returned when a packet is given to an incorrect encoder
type ErrUnexpectedPacket struct {
	Packet abstraction.Packet
}

func (err ErrUnexpectedPacket) Error() string {
	return fmt.Sprintf("expected data packet, got %T instead", err.Packet)
}

// ErrValueNotFound is returned when the provided packet is meassing a value that should be present
type ErrValueNotFound struct {
	Value  valueDescriptor
	Packet abstraction.Packet
}

func (err ErrValueNotFound) Error() string {
	return fmt.Sprintf("could not find value %s in packet %v", err.Value.Name, err.Packet)
}

// ErrMismatchedTypes is returned when the provided value does not match the encoder type
type ErrMismatchedTypes struct {
	Value Value
}

func (err ErrMismatchedTypes) Error() string {
	return fmt.Sprintf("type of value type %T does not match the one of the encoder", err.Value)
}

type ErrUnexpectedVariant struct {
	Name       ValueName
	Variant    EnumVariant
	Descriptor EnumDescriptor
}

func (err ErrUnexpectedVariant) Error() string {
	return fmt.Sprintf("tried to encode %s variant for %s enum, but possibilities are only %v", err.Variant, err.Name, err.Descriptor)
}
