package network

import "time"

// Socket defines a unique conversation over a network by using the source and destination
// IP addresses and TCP/UDP ports.
type Socket struct {
	SrcIP   string
	SrcPort uint16
	DstIP   string
	DstPort uint16
}

// Payload defines a piece of information comming from the network with its metadata
type Payload struct {
	Timestamp time.Time
	Socket    Socket
	Data      []byte
}
