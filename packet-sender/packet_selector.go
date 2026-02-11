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
	for {
		reader := bufio.NewReader(os.Stdin)

		// Mostrar las boards disponibles
		fmt.Println("Boards disponibles:")
		for i, c := range conns {
			fmt.Printf("[%d] %s\n", i, c.board.Name)
		}
		fmt.Print("Selecciona el índice de la board: ")
		boardIdxStr, _ := reader.ReadString('\n')
		boardIdx, _ := strconv.Atoi(strings.TrimSpace(boardIdxStr))
		board := &conns[boardIdx]

		// Mostrar los paquetes disponibles
		fmt.Println("Paquetes disponibles:")
		for i, p := range board.packets {
			fmt.Printf("[%d] ID: %d, Nombre: %s\n", i, p.Id, p.Name)
		}
		fmt.Print("Selecciona el índice del paquete: ")
		packetIdxStr, _ := reader.ReadString('\n')
		packetIdx, _ := strconv.Atoi(strings.TrimSpace(packetIdxStr))
		packet := board.packets[packetIdx]

		// Pedir valores para cada variable
		buff := bytes.NewBuffer(make([]byte, 0))
		binary.Write(buff, binary.LittleEndian, packet.Id)

		for _, v := range packet.Variables {
			fmt.Printf("Introduce valor para %s (%s): ", v.Name, v.Type)
			valStr, _ := reader.ReadString('\n')
			valStr = strings.TrimSpace(valStr)
			writeUserValueAsBytes(valStr, v.Type, buff)
		}

		// Enviar el paquete
		_, err := board.conn.Write(buff.Bytes())
		if err != nil {
			fmt.Println("Error enviando paquete:", err)
		} else {
			fmt.Println("Paquete enviado correctamente.")
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
		// Para enums y otros tipos, puedes agregar lógica adicional aquí
		binary.Write(buff, binary.LittleEndian, uint8(0))
	}
}
