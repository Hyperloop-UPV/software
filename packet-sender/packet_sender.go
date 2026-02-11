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
		for {
			<-ticker.C

			// Get a random board to send the packet from
			randomIndex := rand.Int63n(int64(len(conns)))
			randomBoard := conns[randomIndex]

			packet := randomBoard.CreateRandomPacket()
			fmt.Println(time.Since(prev))
			prev = time.Now()

			if len(packet) < 2 {
				continue
			}

			fmt.Printf("Enviando paquete ID: %d, tamaño: %d\n", binary.LittleEndian.Uint16(packet), len(packet))
			_, err := randomBoard.conn.Write(packet)
			if err != nil {
				continue
			}

			count <- struct{}{}
		}
	}()

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	c := 0
	for {
		select {
		case <-count:
			c++
		case <-interrupt:
			fmt.Printf("%d, %v\n", c, time.Since(start))
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
		if strings.Contains(measurement.Type, "enum") {
			binary.Write(buff, binary.LittleEndian, uint8(rand.Int63n(int64(len(strings.Split(strings.ReplaceAll(strings.TrimSuffix(strings.TrimPrefix(measurement.Type, "enum("), ")"), " ", ""), ","))))))
		} else if measurement.Type == "bool" {
			binary.Write(buff, binary.LittleEndian, rand.Int31n(2) == 1)
		} else if measurement.Type != "string" {
			var number float64
			if len(measurement.WarningRange) == 0 {
				number = mapNumberToRange(rand.Float64(), measurement.WarningRange, measurement.Type)
			} else if measurement.WarningRange[0] != nil && measurement.WarningRange[1] != nil {
				low := *measurement.WarningRange[0] * 0.8
				high := *measurement.WarningRange[1] * 1.2
				number = mapNumberToRange(rand.Float64(), []*float64{&low, &high}, measurement.Type)
			} else {
				// Fallback if any bound is nil
				number = mapNumberToRange(rand.Float64(), []*float64{}, measurement.Type)
			}
			writeNumberAsBytes(number, measurement.Type, buff)
		} else {
			return nil
		}

	}

	return buff.Bytes()
}

func (board *boardConn) CreateSinePacket() []byte {
	randomIndex := rand.Int63n(int64(len(board.packets)))
	randomPacket := board.packets[randomIndex]

	buff := bytes.NewBuffer(make([]byte, 0))

	binary.Write(buff, binary.LittleEndian, randomPacket.Id)

	for _, measurement := range randomPacket.Variables {
		if strings.Contains(measurement.Type, "enum") {
			binary.Write(buff, binary.LittleEndian, uint8(1))
		} else if measurement.Type != "string" {
			sineValue := generateSinusoidalValue()
			number := mapNumberToRange(sineValue, measurement.SafeRange, measurement.Type)
			writeNumberAsBytes(number, measurement.Type, buff)
		} else {
			return nil
		}
	}

	return buff.Bytes()
}

func generateSinusoidalValue() float64 {
	amplitude := 1.0
	frequency := 0.01
	phase := 0.0

	value := amplitude * math.Sin(2*math.Pi*frequency*float64(time.Now().Unix())+phase)
	return value
}
