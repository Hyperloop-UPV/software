package data

import (
	"github.com/HyperloopUPV-H8/h9-backend/internal/update_factory/models"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

type Push struct {
	update *models.Update
}

func NewPush(update *models.Update) *Push {
	return &Push{
		update: update,
	}
}

func (push *Push) Topic() abstraction.BrokerTopic {
	return UpdateName
}

func (push *Push) Update() *models.Update {
	return push.update
}
