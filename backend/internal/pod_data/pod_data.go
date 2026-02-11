package pod_data

import (
	"github.com/HyperloopUPV-H8/h9-backend/internal/utils"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/adj"
	"github.com/HyperloopUPV-H8/h9-backend/internal/common"
)

func NewPodData(adjBoards map[string]adj.Board, globalUnits map[string]utils.Operations) (PodData, error) {
	boards := make([]Board, 0)
	boardErrs := common.NewErrorList()

	for _, adjBoard := range adjBoards {
		board, err := getBoard(adjBoard, globalUnits)

		if err != nil {
			boardErrs.Add(err)
		}

		boards = append(boards, board)
	}

	if len(boardErrs) > 0 {
		return PodData{}, boardErrs
	}

	return PodData{
		Boards: boards,
	}, nil
}

func getBoard(adjBoard adj.Board, globalUnits map[string]utils.Operations) (Board, error) {
	var board Board
	board.Name = adjBoard.Name

	packets := make([]Packet, 0)

	for _, adjPacket := range adjBoard.Packets {
		packet, err := getPacket(adjPacket)
		if err != nil {
			return Board{}, err
		}

		variablesADJ := make([]adj.Measurement, 0)
		for _, packetVariable := range adjPacket.Variables {
			packetVariable = adjBoard.LookUpMeasurements[packetVariable.Id]
			variablesADJ = append(variablesADJ, packetVariable)
		}
		packet.Measurements, err = getMeasurements(variablesADJ, globalUnits)
		packets = append(packets, packet)
	}

	board.Packets = packets

	return board, nil
}

func getPacket(packet adj.Packet) (Packet, error) {
	return Packet{
		Id:           packet.Id,
		Name:         packet.Name,
		Type:         packet.Type,
		HexValue:     "000000",
		Count:        0,
		CycleTime:    0,
		Measurements: make([]Measurement, 0),
	}, nil
}

const DataType = "data"

func GetDataOnlyPodData(podData PodData) PodData {
	newBoards := make([]Board, 0)

	for _, board := range podData.Boards {
		newPackets := common.Filter(board.Packets, func(packet Packet) bool {
			return packet.Type == DataType
		})

		newBoards = append(newBoards, Board{
			Name:    board.Name,
			Packets: newPackets,
		})
	}

	return PodData{
		Boards: newBoards,
	}
}
