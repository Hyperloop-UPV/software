package models

import (
	"errors"

	"github.com/HyperloopUPV-H8/h9-backend/internal/common"
	"github.com/HyperloopUPV-H8/h9-backend/internal/pod_data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

const (
	OrderType      = "order"
	StateOrderType = "stateOrder"
	NumericKind    = "numeric"
	BooleanKind    = "boolean"
	EnumKind       = "enum"
)

type OrderData struct {
	Orders      map[string]OrderDescription `json:"orders"`
	StateOrders map[string]OrderDescription `json:"stateOrders"`
}

type VehicleOrders struct {
	Boards []BoardOrders `json:"boards"`
}

type BoardOrders struct {
	Name        string                  `json:"name"`
	Orders      []OrderDescription      `json:"orders"`
	StateOrders []StateOrderDescription `json:"stateOrders"`
}

type StateOrderDescription struct {
	OrderDescription
	Enabled bool `json:"enabled"`
}

func NewVehicleOrders(boards []pod_data.Board, blcuName string) (VehicleOrders, error) {
	vehicleOrders := VehicleOrders{
		Boards: make([]BoardOrders, 0),
	}

	boardErrs := common.NewErrorList()
	for _, board := range boards {
		boardOrders := BoardOrders{
			Name:        board.Name,
			Orders:      make([]OrderDescription, 0),
			StateOrders: make([]StateOrderDescription, 0),
		}

		packetErrs := common.NewErrorList()
		for _, packet := range board.Packets {
			if packet.Type != OrderType && packet.Type != StateOrderType {
				continue
			}

			fields := make(map[string]any, len(packet.Measurements))
			fieldErrs := common.NewErrorList()
			for _, m := range packet.Measurements {
				field, err := getField(m)

				if err != nil {
					fieldErrs.Add(err)
					continue
				}

				fields[m.GetId()] = field
			}

			if len(fieldErrs) > 0 {
				packetErrs.Add(fieldErrs)
				continue
			}

			desc := OrderDescription{
				Id:     packet.Id,
				Name:   packet.Name,
				Fields: fields,
			}

			if packet.Type == OrderType {
				boardOrders.Orders = append(boardOrders.Orders, desc)
			} else {
				boardOrders.StateOrders = append(boardOrders.StateOrders, StateOrderDescription{OrderDescription: desc, Enabled: false})
			}

		}

		if len(packetErrs) > 0 {
			boardErrs.Add(packetErrs)
			continue
		}

		vehicleOrders.Boards = append(vehicleOrders.Boards, boardOrders)
	}

	if len(boardErrs) > 0 {
		return VehicleOrders{}, boardErrs
	}

	return vehicleOrders, nil
}

func getField(m pod_data.Measurement) (any, error) {
	switch typedMeas := m.(type) {
	case pod_data.NumericMeasurement:
		return NumericDescription{
			fieldDescription: fieldDescription{
				Id:   typedMeas.Id,
				Kind: NumericKind,
				Name: typedMeas.Name,
			},
			VarType:      typedMeas.Type,
			SafeRange:    typedMeas.SafeRange,
			WarningRange: typedMeas.WarningRange,
		}, nil
	case pod_data.BooleanMeasurement:
		return BooleanDescription{
			fieldDescription: fieldDescription{
				Id:   typedMeas.Id,
				Kind: BooleanKind,
				Name: typedMeas.Name,
			},
			VarType: "bool",
		}, nil
	case pod_data.EnumMeasurement:
		return EnumDescription{
			fieldDescription: fieldDescription{
				Id:   typedMeas.Id,
				Kind: EnumKind,
				Name: typedMeas.Name,
			},
			Options: typedMeas.Options,
			VarType: "enum",
		}, nil
	default:
		return struct{}{}, errors.New("unrecognized measurement type")
	}
}

type OrderDescription struct {
	Id     abstraction.PacketId `json:"id"`
	Name   string               `json:"name"`
	Fields map[string]any       `json:"fields"`
}

type fieldDescription struct {
	Kind string `json:"kind"`
	Id   string `json:"id"`
	Name string `json:"name"`
}

type NumericDescription struct {
	fieldDescription
	VarType      string     `json:"type"`
	SafeRange    []*float64 `json:"safeRange"`
	WarningRange []*float64 `json:"warningRange"`
}

type BooleanDescription struct {
	fieldDescription
	VarType string `json:"type"`
}

type EnumDescription struct {
	fieldDescription
	Options []string `json:"options"`
	VarType string   `json:"type"`
}
