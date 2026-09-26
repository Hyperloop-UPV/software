package pod_data

import (
	"github.com/HyperloopUPV-H8/h9-backend/internal/utils"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

type PodData struct {
	Boards []Board `json:"boards"`
}

type Board struct {
	Name    string   `json:"name"`
	Packets []Packet `json:"packets"`
}

type Packet struct {
	Id           abstraction.PacketId `json:"id"`
	Name         string               `json:"name"`
	Type         string               `json:"type"` //TODO: add in front
	HexValue     string               `json:"hexValue"`
	Count        uint16               `json:"count"`
	CycleTime    int64                `json:"cycleTime"`
	Measurements []Measurement        `json:"measurements"`
}

type Measurement interface {
	GetId() string
	GetName() string
	GetType() string
}

type NumericMeasurement struct {
	Id           string      `json:"id"` // Remove json tags
	Name         string      `json:"name"`
	Type         string      `json:"type"`
	Units        string      `json:"units"`
	DisplayUnits utils.Units `json:"-"`
	PodUnits     utils.Units `json:"-"`
	SafeRange    []*float64  `json:"safeRange"`
	WarningRange []*float64  `json:"warningRange"`
}

func (m NumericMeasurement) GetId() string {
	return m.Id
}

func (m NumericMeasurement) GetName() string {
	return m.Name
}

func (m NumericMeasurement) GetType() string {
	return m.Type
}

type BooleanMeasurement struct {
	Id   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

func (m BooleanMeasurement) GetId() string {
	return m.Id
}

func (m BooleanMeasurement) GetName() string {
	return m.Name
}

func (m BooleanMeasurement) GetType() string {
	return m.Type
}

type EnumMeasurement struct {
	Id      string   `json:"id"`
	Name    string   `json:"name"`
	Type    string   `json:"type"`
	Options []string `json:"options"`
}

func (m EnumMeasurement) GetId() string {
	return m.Id
}

func (m EnumMeasurement) GetName() string {
	return m.Name
}

func (m EnumMeasurement) GetType() string {
	return m.Type
}
