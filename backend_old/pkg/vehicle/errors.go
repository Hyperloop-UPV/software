package vehicle

import (
	"fmt"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

type ErrUnexpectedNotification struct {
	Notification abstraction.TransportNotification
}

func (err ErrUnexpectedNotification) Error() string {
	return fmt.Sprintf("Unexpected notification type: %T", err.Notification)
}
