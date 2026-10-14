package adj

import (
	"encoding/json"
	"os"
	"path"
)

func getBoards(RepoPath string, boardsList map[string]string) (map[string]Board, error) {
	boards := make(map[string]Board, len(boardsList))
	for boardName, boardPath := range boardsList {
		fullPath := path.Join(RepoPath, boardPath)
		boardRaw, err := os.ReadFile(fullPath)
		if err != nil {
			return nil, err
		}

		var boardJSON BoardJSON
		if err = json.Unmarshal(boardRaw, &boardJSON); err != nil {
			return nil, err
		}

		measPathsFr := make([]string, 0)
		for _, measPath := range boardJSON.MeasurementsPaths {
			measPathsFr = append(measPathsFr, path.Join(RepoPath, "boards", boardName, measPath))
		}
		boardJSON.MeasurementsPaths = measPathsFr

		packetPathsFr := make([]string, 0)
		for _, packetPath := range boardJSON.PacketsPaths {
			packetPathsFr = append(packetPathsFr, path.Join(RepoPath, "boards", boardName, packetPath))
		}
		boardJSON.PacketsPaths = packetPathsFr

		board := Board{
			Name: boardName,
			IP:   boardJSON.IP,
		}

		boardPackets, err := getBoardPackets(boardJSON.PacketsPaths)
		if err != nil {
			return nil, err
		}

		board.Measurements, err = getBoardMeasurements(boardJSON.MeasurementsPaths)
		if err != nil {
			return nil, err
		}

		board.LookUpMeasurements = make(map[string]Measurement, len(board.Measurements))
		for _, measurement := range board.Measurements {
			board.LookUpMeasurements[measurement.Id] = measurement
		}

		board.Packets = lookUpMeas(boardPackets, board.LookUpMeasurements)

		board.Structures = getBoardStructures(board)

		boards[boardName] = board
	}

	return boards, nil
}

func lookUpMeas(packetsTMP []Packet, lookUpMeas map[string]Measurement) []Packet {
	packetsFNL := make([]Packet, 0)
	for _, packetTMP := range packetsTMP {
		measFNL := make([]Measurement, 0)
		for _, measId := range packetTMP.VariablesIds {
			meas := lookUpMeas[measId]
			measFNL = append(measFNL, meas)
		}

		packetTMP.Variables = measFNL
		packetsFNL = append(packetsFNL, packetTMP)
	}

	return packetsFNL
}

func getBoardPackets(packetsPaths []string) ([]Packet, error) {
	packets := make([]Packet, 0)

	for _, packetPath := range packetsPaths {
		if _, err := os.Stat(packetPath); os.IsNotExist(err) {
			continue
		}

		packetRaw, err := os.ReadFile(packetPath)
		if err != nil {
			return nil, err
		}

		packet := make([]Packet, 0)

		if err = json.Unmarshal(packetRaw, &packet); err != nil {
			return nil, err
		}

		packets = append(packets, packet...)
	}

	return packets, nil
}

// Absolutely doing tricks on it AGAIN, AGAIN - @msanlli
func getBoardMeasurements(measurementsPaths []string) ([]Measurement, error) {
	measurementsJSON := make([]Measurement, 0)

	for _, measurementPath := range measurementsPaths {
		if _, err := os.Stat(measurementPath); os.IsNotExist(err) {
			println("ADJ Error: Measurement file path not found")
			continue
		}

		measTMP := make([]Measurement, 0)

		measurementRaw, err := os.ReadFile(measurementPath)
		if err != nil {
			return nil, err
		}

		if err = json.Unmarshal(measurementRaw, &measTMP); err != nil {
			return nil, err
		}

		measurementsJSON = append(measurementsJSON, measTMP...)
	}

	measurements, err := measTranslate(measurementsJSON)
	if err != nil {
		return nil, err
	}

	return measurements, nil
}

func measTranslate(measurementsTMP []Measurement) ([]Measurement, error) {
	measurements := make([]Measurement, 0)

	for _, measJSON := range measurementsTMP {
		var err error

		measJSON.SafeRange, measJSON.WarningRange, err = getRanges(measJSON)
		if err != nil {
			return nil, err
		}

		measurements = append(measurements, measJSON)
	}

	return measurements, nil
}

func getRanges(measTMP Measurement) ([]*float64, []*float64, error) {
	safeRange := make([]*float64, 0)
	warningRange := make([]*float64, 0)

	if measTMP.OutOfRange.Safe == nil && measTMP.OutOfRange.Warning == nil {
		if measTMP.Below.Safe == nil && measTMP.Below.Warning == nil && measTMP.Above.Safe == nil && measTMP.Above.Warning == nil {
			safeRange = append(safeRange, []*float64{nil, nil}...)
			warningRange = append(warningRange, []*float64{nil, nil}...)
		} else if measTMP.Below.Safe == nil {
			safeRange = append(safeRange, []*float64{nil}...)
		} else {
			safeRange = append(safeRange, measTMP.Below.Safe)
		}

		if measTMP.Above.Safe == nil {
			safeRange = append(safeRange, []*float64{nil}...)
		} else {
			safeRange = append(safeRange, measTMP.Above.Safe)
		}

		if measTMP.Below.Warning == nil {
			warningRange = append(warningRange, []*float64{nil}...)
		} else {
			warningRange = append(warningRange, measTMP.Below.Warning)
		}

		if measTMP.Above.Warning == nil {
			warningRange = append(warningRange, []*float64{nil}...)
		} else {
			warningRange = append(warningRange, measTMP.Above.Warning)
		}
	} else if measTMP.OutOfRange.Safe == nil {
		safeRange = append(safeRange, []*float64{nil, nil}...)
		warningRange = append(warningRange, measTMP.OutOfRange.Warning...)
	} else if measTMP.OutOfRange.Warning == nil {
		safeRange = append(safeRange, measTMP.OutOfRange.Safe...)
		warningRange = append(warningRange, []*float64{nil, nil}...)
	} else {
		safeRange = append(safeRange, measTMP.OutOfRange.Safe...)
		warningRange = append(warningRange, measTMP.OutOfRange.Warning...)
	}

	return safeRange, warningRange, nil
}

func getBoardIds(boards map[string]string) (map[string]uint16, error) {
	boardIds := make(map[string]uint16, len(boards))
	for boardName, boardPath := range boards {
		fullPath := path.Join(RepoPath, boardPath)
		boardRaw, err := os.ReadFile(fullPath)
		if err != nil {
			return nil, err
		}

		var boardJSON BoardJSON
		if err = json.Unmarshal(boardRaw, &boardJSON); err != nil {
			return nil, err
		}

		boardIds[boardName] = boardJSON.ID
	}

	return boardIds, nil
}

func getBoardStructures(board Board) []Structure {
	structures := make([]Structure, len(board.Packets))
	for i, packet := range board.Packets {
		structures[i] = Structure{
			Packet:       packet,
			Measurements: board.Measurements,
		}
	}

	return structures
}

func getAddresses(boards map[string]Board) (map[string]string, error) {
	addresses := make(map[string]string, len(boards))
	for boardName, board := range boards {
		addresses[boardName] = board.IP
	}

	return addresses, nil
}
