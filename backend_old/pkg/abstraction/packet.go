package abstraction

// PacketId is the unique id of a packet
type PacketId uint16

// Packet is the abstraction of information sent or received from the vehicle
type Packet interface {
	Id() PacketId
}
