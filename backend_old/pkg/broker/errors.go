package broker

import (
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

type ErrTopicNotFound struct {
	Topic abstraction.BrokerTopic
}

func (err ErrTopicNotFound) Error() string {
	return "topic not found"
}
