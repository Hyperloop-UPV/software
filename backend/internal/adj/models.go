package adj

import (
	"github.com/HyperloopUPV-H8/h9-backend/internal/utils"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

type ADJ struct {
	Info   Info
	Boards map[string]Board
}

type InfoJSON struct {
	Ports      map[string]uint16 `json:"ports"`
	Addresses  map[string]string
	Units      map[string]string `json:"units"`
	MessageIds map[string]uint16 `json:"message_ids"`
	BoardIds   map[string]uint16
}

type Info struct {
	Ports      map[string]uint16
	Addresses  map[string]string
	Units      map[string]utils.Operations
	MessageIds map[string]uint16
	BoardIds   map[string]uint16
}

type BoardJSON struct {
	ID                uint16   `json:"board_id"`
	IP                string   `json:"board_ip"`
	MeasurementsPaths []string `json:"measurements"`
	PacketsPaths      []string `json:"packets"`
}

type Board struct {
	Name               string
	IP                 string
	Packets            []Packet
	Measurements       []Measurement
	Structures         []Structure
	LookUpMeasurements map[string]Measurement
}

type Packet struct {
	Id           abstraction.PacketId `json:"id"`
	Name         string               `json:"name"`
	Type         string               `json:"type"`
	Variables    []Measurement
	VariablesIds []string `json:"variables"`
}

type Measurement struct {
	Id           string   `json:"id"`
	Name         string   `json:"name"`
	Type         string   `json:"type"`
	PodUnits     string   `json:"podUnits"`
	DisplayUnits string   `json:"displayUnits"`
	EnumValues   []string `json:"enumValues"`
	SafeRange    []*float64
	WarningRange []*float64
	Below        BelowOrAbove `json:"below"`
	Above        BelowOrAbove `json:"above"`
	OutOfRange   OutOfRange   `json:"out_of_range"`
}

type BelowOrAbove struct {
	Safe    *float64 `json:"safe"`
	Warning *float64 `json:"warning"`
}

type OutOfRange struct {
	Safe    []*float64 `json:"safe"`
	Warning []*float64 `json:"warning"`
}

type Structure struct {
	Packet       Packet
	Measurements []Measurement
}
