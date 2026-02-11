package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"os"
	"path"
	"path/filepath"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/pkg/adj"
)

type boardConn struct {
	conn    *net.UDPConn
	packets []adj_module.Packet
	board   adj_module.Board
}

func main() {

	adj := getADJ()

	backend_address := adj.Info.Addresses["BACKEND"]
	backend_port := adj.Info.Ports["UDP"]

	// Create a listener so the packets don't get lost (the backend will sniff them)
	listener, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP(backend_address), Port: int(backend_port)})
	if err != nil {
		log.Fatalf("Error creando listener UDP: %v", err)
	}
	defer listener.Close()

	conns := getConns(adj)

	defer func() {
		for _, c := range conns {
			c.conn.Close()
		}
	}()

	// Get the list of packets for each board
	for i := range conns {
		getBoardPackets(&conns[i])
	}

	var input string
	fmt.Print("Quieres lanzar paquetes aleatorios (1) o manualmente (2): ")
	_, err = fmt.Scan(&input)
	if err != nil {
		log.Fatal("Invalid input", err)
	}

	if input == "1" {
		PacketSender(conns)
	}
	if input == "2" {
		PacketSelector(conns)
	}
}

func getConns(adj adj_module.ADJ) []boardConn {
	conns := make([]boardConn, 0)

	for _, board := range adj.Boards {
		conn := getConn(board.IP, 0, "127.0.0.9", 8000)
		conns = append(conns, boardConn{
			conn:    conn,
			packets: []adj_module.Packet{},
			board:   board,
		})
	}

	return conns
}

func getConn(lip string, lport uint16, rip string, rport uint16) *net.UDPConn {
	laddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", lip, lport))
	if err != nil {
		log.Fatalf("resolve address: %s\n", err)
	}
	raddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", rip, rport))
	if err != nil {
		log.Fatalf("resolve address: %s\n", err)
	}
	conn, err := net.DialUDP("udp", laddr, raddr)

	if err != nil {
		log.Fatal("Error creating udp connection", err)
	}

	return conn
}

func getADJ() adj_module.ADJ {
	err := os.RemoveAll("adj")
	if err != nil {
		log.Fatalf("Failed to delete ADJ")
	}

	// Copy the ADJ from the backend folder to ensure they are the same
	err = CopyDir(path.Join("..", "backend", "cmd", "adj"), "adj")
	if err != nil {
		log.Fatal(err)
	}

	adj, err := adj_module.NewADJ("", false)
	if err != nil {
		log.Fatalf("Failed to load ADJ: %v\n", err)
	}

	return adj
}

func getBoardPackets(boardconn *boardConn) {

	packets := make([]adj_module.Packet, 0)

	for _, packet := range boardconn.board.Packets {
		if packet.Type != "data" {
			continue
		}

		packets = append(packets, adj_module.Packet{
			Id:           packet.Id,
			Name:         packet.Name,
			Type:         packet.Type,
			Variables:    packet.Variables,
			VariablesIds: packet.VariablesIds,
		})
	}

	boardconn.packets = packets

}

func mapNumberToRange(number float64, numberRange []*float64, numberType string) float64 {
	if len(numberRange) == 0 {
		return number * getTypeMaxValue(numberType)
	} else {
		return (number * (*numberRange[1] - *numberRange[0])) + *numberRange[0]
	}
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

// Copies a directory recursively from src to dst
func CopyDir(src string, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		targetPath := filepath.Join(dst, relPath)
		if info.IsDir() {
			return os.MkdirAll(targetPath, info.Mode())
		}
		// Copy file
		return copyFile(path, targetPath, info.Mode())
	})
}

func copyFile(src, dst string, perm os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	if err != nil {
		return err
	}
	return out.Chmod(perm)
}
