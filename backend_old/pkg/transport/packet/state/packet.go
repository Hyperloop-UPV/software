package state

import "github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"

// Space represents the state space packet
//
// the state space represents the control parameters being used
type Space struct {
	id    abstraction.PacketId
	state [8][15]float32
}

func NewSpace(id abstraction.PacketId, state [8][15]float32) *Space {
	return &Space{
		id:    id,
		state: state,
	}
}

// Id returns the packet id
func (packet *Space) Id() abstraction.PacketId {
	return packet.id
}

// State returns the state space matrix
func (packet *Space) State() [8][15]float32 {
	return packet.state
}
