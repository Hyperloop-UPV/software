package topics

import (
	"fmt"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

type ErrOpNotSupported struct{}

func (err ErrOpNotSupported) Error() string {
	return "operation not supported"
}

type ErrUnexpectedPush struct {
	Push abstraction.BrokerPush
}

func (err ErrUnexpectedPush) Error() string {
	return fmt.Sprintf("push has unexpected type %T", err.Push)
}
