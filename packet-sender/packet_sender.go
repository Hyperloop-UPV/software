package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"os/signal"
	"strings"
	"time"
)

func PacketSender(conns []boardConn) {
	count := make(chan struct{}, 10000)
	start := time.Now()
	prev := time.Now()
	go func() {
		ticker := time.NewTicker(10 * time.Millisecond)
		defer ticker.Stop()
		for range ticker.C {
			// Get a random board to send the packet from
			randomIndex := rand.Int63n(int64(len(conns)))
			randomBoard := conns[randomIndex]

			packet := randomBoard.CreateRandomPacket()
			fmt.Println(time.Since(prev))
			prev = time.Now()

			if len(packet) < 2 {
				continue
			}

			fmt.Printf("Sending packet ID: %d, size: %d\n", binary.LittleEndian.Uint16(packet), len(packet))
			_, err := randomBoard.conn.Write(packet)
			if err != nil {
				continue
			}

			count <- struct{}{}
		}
	}()

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)
	defer signal.Stop(interrupt)

	sent := 0
	for {
		select {
		case <-count:
			sent++
		case <-interrupt:
			fmt.Printf("Sent=%d,  Elapsed=%v\n", sent, time.Since(start))
			return
		}
	}
}

func (board *boardConn) CreateRandomPacket() []byte {
	if len(board.packets) == 0 {
		return nil
	}

	randomIndex := rand.Int63n(int64(len(board.packets)))
	randomPacket := board.packets[randomIndex]

	if len(randomPacket.VariablesIds) == 0 {
		log.Printf("The packet with ID %d has no measurements\n", randomPacket.Id)
		return nil
	}

	buff := bytes.NewBuffer(make([]byte, 0))

	binary.Write(buff, binary.LittleEndian, randomPacket.Id)

	for _, measurement := range randomPacket.Variables {
		switch {
		case strings.Contains(measurement.Type, "enum"):
			n := enumOptionCount(measurement.Type)
			binary.Write(buff, binary.LittleEndian, uint8(rand.Intn(n)))
		case measurement.Type == "bool":
			binary.Write(buff, binary.LittleEndian, rand.Intn(2) == 1)
		case measurement.Type == "string":
			return nil
		default:
			var number float64
			// If warning bounds are unavailable, fall back to full type range.
			if(len(measurement.WarningRange) == 0) {
				number = mapNumberToRange(rand.Float64(), nil, measurement.Type)
			} else if measurement.WarningRange[0] != nil && measurement.WarningRange[1] != nil {
				low := *measurement.WarningRange[0] * 0.8
				high := *measurement.WarningRange[1] * 1.2
				number = mapNumberToRange(rand.Float64(), []*float64{&low, &high}, measurement.Type)
			} else {
				number = mapNumberToRange(rand.Float64(), nil, measurement.Type)
			}
			writeNumberAsBytes(number, measurement.Type, buff)
		}
	}
	return buff.Bytes()
}

func enumOptionCount(t string) int {
	trimmed := strings.TrimSuffix(strings.TrimPrefix(t, "enum("), ")")
	trimmed = strings.ReplaceAll(trimmed, " ", "")
	if trimmed == "" {
		return 0
	}
	return len(strings.Split(trimmed, ","))
}

func mapNumberToRange(number float64, numberRange []*float64, numberType string) float64 {
	if len(numberRange) == 0 {
		return number * getTypeMaxValue(numberType)
	}
	return (number * (*numberRange[1] - *numberRange[0])) + *numberRange[0]
}

func getTypeMaxValue(numberType string) float64 {
	switch numberType {
	case "uint8":
		return math.MaxUint8
	case "uint16":
		return math.MaxUint16
	case "uint32":
		return math.MaxUint32
	case "uint64":
		return math.MaxUint64
	case "int8":
		return math.MaxInt8
	case "int16":
		return math.MaxInt16
	case "int32":
		return math.MaxInt32
	case "int64":
		return math.MaxInt64
	case "float32":
		return math.MaxFloat32
	case "float64":
		return math.MaxFloat64
	case "bool":
		return math.MaxUint8
	default:
		return math.MaxUint8
	}
}

func writeNumberAsBytes(number float64, numberType string, buff *bytes.Buffer) {
	switch numberType {
	case "uint8":
		binary.Write(buff, binary.LittleEndian, uint8(number))
	case "uint16":
		binary.Write(buff, binary.LittleEndian, uint16(number))
	case "uint32":
		binary.Write(buff, binary.LittleEndian, uint32(number))
	case "uint64":
		binary.Write(buff, binary.LittleEndian, uint64(number))
	case "int8":
		binary.Write(buff, binary.LittleEndian, int8(number))
	case "int16":
		binary.Write(buff, binary.LittleEndian, int16(number))
	case "int32":
		binary.Write(buff, binary.LittleEndian, int32(number))
	case "int64":
		binary.Write(buff, binary.LittleEndian, int64(number))
	case "float32":
		binary.Write(buff, binary.LittleEndian, float32(number))
	case "float64":
		binary.Write(buff, binary.LittleEndian, number)
	case "bool":
		binary.Write(buff, binary.LittleEndian, uint8(number))
	default:
		binary.Write(buff, binary.LittleEndian, uint8(number))
	}
}