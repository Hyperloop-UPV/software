// # Protection packets:
// Protection packets are used to notify of unexpected values and dangerous situations.
//
// There are two types of protection packets:
//   - Fault: used to notify of unsafe conditions, the system will stop automatically when a fault is triggered.
//   - Warning: used to notify of unexpected values, the user should check everything is working correctly.
//   - Ok: used to notify of a previous unexpected value returning back to the appropiate range.
//
// Independent of the type, all protection packets follow the same structure defined below.
//
// All protection packets will be displayed on the GUI with different cues depending on the severity of the protection.
//
// # Structure:
//
//	0        8        16       24       32
//	|========|========|========|========|
//	|   id   |   id   |  type  |  kind  |
//	|========|========|========|========|
//	|  name  |  name  |  ...   |  0x00  |
//	|========|========|========|========|
//	|  data  |  data  |  data  |  data  |
//	|========|========|========|========|
//	|  ...   |  ...   |  ...   |  ...   |
//	|========|========|========|========|
//	|  data  |  data  |  data  |  data  |
//	|========|========|========|========|
//	|counter |counter | second | minute |
//	|========|========|========|========|
//	|  hour  |  day   | month  |  year  |
//	|========|========|========|========|
//	|  year  |
//	|========|
package protection

import (
	"encoding/binary"
	"io"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// Packet is a protection packet, see the package documentation for more information.
type Packet struct {
	id        abstraction.PacketId
	Type      Type
	Kind      Kind
	Name      string
	Data      Data
	Timestamp *Timestamp
	severity  Severity
}

// NewPacket creates a new empty protection packet with the given ID.
func NewPacket(id abstraction.PacketId, severity Severity) *Packet {
	return &Packet{
		id:       id,
		severity: severity,
	}
}

// Id returns the id of the packet.
func (packet *Packet) Id() abstraction.PacketId {
	return packet.id
}

func (packet *Packet) Severity() Severity {
	return packet.severity
}

// Severity is the severity of the protection.
type Severity string

const (
	FaultSeverity   Severity = "fault"
	WarningSeverity Severity = "warning"
	OkSeverity      Severity = "ok"
)

// Type is the type of the data that is being tracked by a protection packet.
type Type uint8
type valueType interface {
	int8 | int16 | int32 | int64 | uint8 | uint16 | uint32 | uint64 | float32 | float64 | bool
}

const (
	IntType    Type = iota // int32
	FloatType              // float32
	DoubleType             // float64
	CharType               // byte
	BoolType               // bool
	ShortType              // int16
	LongType               // int64
	Uint8Type              // uint8
	Uint16Type             // uint16
	Uint32Type             // uint32
	Uint64Type             // uint64
	Int8Type               // int8
)

// Kind defines the condition for the protection to trigger.
type Kind uint8

const (
	BelowKind            Kind = iota // [Below]
	AboveKind                        // [Above]
	OutOfBoundsKind                  // [OutOfBounds]
	EqualsKind                       // [Equals]
	NotEqualsKind                    // [NotEquals]
	ErrorHandlerKind                 // [ErrorHandler]
	TimeAccumulationKind             // [TimeAccumulation]
	WarningKind                      // [Warning]
)

// Data is a common interface to all the possible protection kinds.
type Data interface {
	Name() string
	Kind() Kind
}

// The following are possible data specifications for each kind of protection.
var (
	_ Data = &Below[int8]{}
	_ Data = &Above[int8]{}
	_ Data = &OutOfBounds[int8]{}
	_ Data = &Equals[int8]{}
	_ Data = &NotEquals[int8]{}
	_ Data = &ErrorHandler{}
	_ Data = &TimeAccumulation[int8]{}
)

// Timestamp is the Timestamp of the protection generated from the RTC.
type Timestamp struct {
	Counter uint16 `json:"counter"`
	Second  uint8  `json:"second"`
	Minute  uint8  `json:"minute"`
	Hour    uint8  `json:"hour"`
	Day     uint8  `json:"day"`
	Month   uint8  `json:"month"`
	Year    uint16 `json:"year"`
}

func NowTimestamp() *Timestamp {
	t := time.Now()
	return &Timestamp{
		Counter: 0,
		Second:  uint8(t.Second()),
		Minute:  uint8(t.Minute()),
		Hour:    uint8(t.Hour()),
		Day:     uint8(t.Day()),
		Month:   uint8(t.Month()),
		Year:    uint16(t.Year()),
	}
}

func decodeTimestamp(reader io.Reader, endianness binary.ByteOrder) (*Timestamp, error) {
	packet := new(Timestamp)
	err := binary.Read(reader, endianness, packet)
	return packet, err
}

func (timestamp *Timestamp) ToTime() time.Time {
	return time.Date(int(timestamp.Year), time.Month(timestamp.Month), int(timestamp.Day), int(timestamp.Hour), int(timestamp.Minute), int(timestamp.Second), 0, time.UTC)
}
