package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func PacketSelector(conns []boardConn) {
	reader := bufio.NewReader(os.Stdin)
	for {
		// Show available boards
		fmt.Println("Available boards:")
		for i, c := range conns {
			fmt.Printf("[%d] %s\n", i, c.board.Name)
		}
		fmt.Print("Select board index: ")
		boardIdxStr, _ := reader.ReadString('\n')
		boardIdx, err := strconv.Atoi(strings.TrimSpace(boardIdxStr))
		if err != nil || boardIdx < 0 || boardIdx >= len(conns) {
			fmt.Println("Invalid board index")
			continue
		}
		board := &conns[boardIdx]

		// Show available packets
		fmt.Println("Available packets:")
		for i, p := range board.packets {
			fmt.Printf("[%d] ID: %d, Nombre: %s\n", i, p.Id, p.Name)
		}
		fmt.Print("Select packet index: ")
		packetIdxStr, _ := reader.ReadString('\n')
		packetIdx, err := strconv.Atoi(strings.TrimSpace(packetIdxStr))
		if err != nil || packetIdx < 0 || packetIdx >= len(board.packets) {
			fmt.Println("Invalid packet index")
			continue
		}
		packet := board.packets[packetIdx]

		// Ask values for each variable
		buff := bytes.NewBuffer(make([]byte, 0))
		binary.Write(buff, binary.LittleEndian, packet.Id)

		for _, v := range packet.Variables {
			fmt.Printf("Enter value for %s (%s): ", v.Name, v.Type)
			valStr, _ := reader.ReadString('\n')
			valStr = strings.TrimSpace(valStr)
			writeUserValueAsBytes(valStr, v.Type, buff)
		}

		// Send packet
		_, err = board.conn.Write(buff.Bytes())
		if err != nil {
			fmt.Println("Error sending packet:", err)
		} else {
			fmt.Println("Packet sent successfully.")
		}
	}
}

func writeUserValueAsBytes(valStr, typ string, buff *bytes.Buffer) {
	switch typ {
	case "uint8":
		v, _ := strconv.ParseUint(valStr, 10, 8)
		binary.Write(buff, binary.LittleEndian, uint8(v))
	case "uint16":
		v, _ := strconv.ParseUint(valStr, 10, 16)
		binary.Write(buff, binary.LittleEndian, uint16(v))
	case "uint32":
		v, _ := strconv.ParseUint(valStr, 10, 32)
		binary.Write(buff, binary.LittleEndian, uint32(v))
	case "uint64":
		v, _ := strconv.ParseUint(valStr, 10, 64)
		binary.Write(buff, binary.LittleEndian, uint64(v))
	case "int8":
		v, _ := strconv.ParseInt(valStr, 10, 8)
		binary.Write(buff, binary.LittleEndian, int8(v))
	case "int16":
		v, _ := strconv.ParseInt(valStr, 10, 16)
		binary.Write(buff, binary.LittleEndian, int16(v))
	case "int32":
		v, _ := strconv.ParseInt(valStr, 10, 32)
		binary.Write(buff, binary.LittleEndian, int32(v))
	case "int64":
		v, _ := strconv.ParseInt(valStr, 10, 64)
		binary.Write(buff, binary.LittleEndian, int64(v))
	case "float32":
		v, _ := strconv.ParseFloat(valStr, 32)
		binary.Write(buff, binary.LittleEndian, float32(v))
	case "float64":
		v, _ := strconv.ParseFloat(valStr, 64)
		binary.Write(buff, binary.LittleEndian, v)
	case "bool":
		v := valStr == "true" || valStr == "1"
		binary.Write(buff, binary.LittleEndian, v)
	default:
		// Add extra handling for enums and other types here.
		binary.Write(buff, binary.LittleEndian, uint8(0))
	}
}
