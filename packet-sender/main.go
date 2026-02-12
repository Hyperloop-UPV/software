package main

import (
	"fmt"
	"log"
	"net"
	"path"
	"path/filepath"
	"strings"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/pkg/adj"
)

type boardConn struct {
	conn    *net.UDPConn
	packets []adj_module.Packet
	board   adj_module.Board
}

func main() {
	adj := getADJ()

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

	fmt.Print("Do you want to send random packets (1) or manual packets (2)? ")
	var input string
	_, err := fmt.Scan(&input)
	if err != nil {
		log.Fatalf("failed to read input: %v", err)
	}

	input = strings.TrimSpace(input)
	if input != "1" && input != "2" {
		log.Fatal("invalid input: use 1 or 2")
	}

	if input == "1" {
		PacketSender(conns)
	} else if input == "2" {
		PacketSelector(conns)
	}
}

func getConns(adj adj_module.ADJ) []boardConn {
	conns := make([]boardConn, 0)

	for _, board := range adj.Boards {
		conn := getConn(board.IP, 0, adj.Info.Addresses["backend"], adj.Info.Ports["UDP"])
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

// getADJ loads the same ADJ used by backend directly from backend/cmd/adj.
func getADJ() adj_module.ADJ {
	adjPath, err := filepath.Abs(path.Join("..", "backend", "cmd", "adj"))
	if err != nil {
		log.Fatalf("Failed to resolve ADJ path: %v", err)
	}
	adj_module.RepoPath = adjPath + string(filepath.Separator)

	adj, err := adj_module.NewADJ("")
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