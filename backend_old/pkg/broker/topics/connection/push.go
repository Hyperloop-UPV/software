package connection

import "github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"

type Connection struct {
	Name        string `json:"name"`
	IsConnected bool   `json:"isConnected"`
}

func NewConnection(name string, isConnected bool) *Connection {
	return &Connection{
		Name:        name,
		IsConnected: isConnected,
	}
}

func (connection *Connection) Topic() abstraction.BrokerTopic {
	return UpdateName
}
