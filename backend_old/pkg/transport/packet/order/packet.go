package order

import "github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"

// action represents an action to be performed to the current state orders
type action string

const (
	ActionAdd    action = "add"
	ActionRemove action = "remove"
)

// Add is a request to add the included orders to the current list of enabled state orders
type Add struct {
	id     abstraction.PacketId
	orders []abstraction.PacketId
}

// NewAdd creates a new Add packet
func NewAdd(id abstraction.PacketId, orders []abstraction.PacketId) *Add {
	return &Add{
		id:     id,
		orders: orders,
	}
}

// Id returns the packet id
func (packet *Add) Id() abstraction.PacketId {
	return packet.id
}

// Orders returns the orders that need to be added
func (packet *Add) Orders() []abstraction.PacketId {
	return packet.orders
}

// Action returns the action kind for this request
func (packet *Add) Action() action {
	return ActionAdd
}

// Remove is a request to remove the included orders from the list of enabled state orders
type Remove struct {
	id     abstraction.PacketId
	orders []abstraction.PacketId
}

// NewRemove creates a new Add packet
func NewRemove(id abstraction.PacketId, orders []abstraction.PacketId) *Remove {
	return &Remove{
		id:     id,
		orders: orders,
	}
}

// Id returns the packet id
func (packet *Remove) Id() abstraction.PacketId {
	return packet.id
}

// Orders returns the orders that need to be removed
func (packet *Remove) Orders() []abstraction.PacketId {
	return packet.orders
}

// Action returns the action kind for this request
func (packet *Remove) Action() action {
	return ActionRemove
}
