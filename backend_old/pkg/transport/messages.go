package transport

import (
	"io"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

const (
	// PacketEvent is triggered when a packet is sent or received
	PacketEvent abstraction.TransportEvent = "packet"
	// ErrorEvent is triggered when an error arises somewhere
	ErrorEvent abstraction.TransportEvent = "error"
	// FileWriteEvent is used to request a file write through tftp
	FileWriteEvent abstraction.TransportEvent = "file-push"
	// FileReadEvent is used to request a file read through tftp
	FileReadEvent abstraction.TransportEvent = "file-pull"
)

// PacketMessage request a packet to be sent to the vehicle.
type PacketMessage struct {
	abstraction.Packet
}

func NewPacketMessage(packet abstraction.Packet) PacketMessage {
	return PacketMessage{
		Packet: packet,
	}
}

// Event always returns PacketEvent
func (message PacketMessage) Event() abstraction.TransportEvent {
	return PacketEvent
}

// FileWriteMessage request a file to be written to a specific target
type FileWriteMessage struct {
	filename string
	io.Reader
}

func NewFileWriteMessage(filename string, input io.Reader) FileWriteMessage {
	return FileWriteMessage{
		filename: filename,
		Reader:   input,
	}
}

// Event is always FileWriteEvent
func (message FileWriteMessage) Event() abstraction.TransportEvent {
	return FileWriteEvent
}

func (message FileWriteMessage) Filename() string {
	return message.filename
}

// FileReadMessage request a file to be read from the specific target.
type FileReadMessage struct {
	filename string
	io.Writer
}

func NewFileReadMessage(filename string, output io.Writer) FileReadMessage {
	return FileReadMessage{
		filename: filename,
		Writer:   output,
	}
}

// Event always returns FileReadEvent
func (message FileReadMessage) Event() abstraction.TransportEvent {
	return FileReadEvent
}

func (message FileReadMessage) Filename() string {
	return message.filename
}
