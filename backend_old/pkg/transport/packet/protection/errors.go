package protection

import (
	"fmt"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// ErrUnexpectedType is returned when the type of the protection value is not recognized
type ErrUnexpectedType struct {
	Type Type
}

func (err ErrUnexpectedType) Error() string {
	return fmt.Sprintf("unexpected value for type %d", err.Type)
}

// ErrUnexpectedKind is returned when the kind of the protection value is not recognized
type ErrUnexpectedKind struct {
	Kind Kind
}

func (err ErrUnexpectedKind) Error() string {
	return fmt.Sprintf("unexpected value for kind %d", err.Kind)
}

// ErrUnexpectedId is returned when the id of the protection packet is not recognized
type ErrUnexpectedId struct {
	Id abstraction.PacketId
}

func (err ErrUnexpectedId) Error() string {
	return fmt.Sprintf("unexpected packet with id %d", err.Id)
}
