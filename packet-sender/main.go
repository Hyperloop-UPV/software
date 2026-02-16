package main

import (
	"fmt"
	"log"
	"net"
	boardpkg "packet_sender/pkg/board"
	"packet_sender/pkg/listener"
	"packet_sender/pkg/sender"
	"path"
	"path/filepath"
	"strings"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/pkg/adj"
)

func main() {
	adj := getADJ()
	conns := getConns(adj)

	input := getBinaryInput("Select mode:\n1) Send packets\n2) Listen packets")

	switch input {
	case "1":
		input := getBinaryInput("Do you want to send random or custom packets?\n1) Random\n2) Custom")
		sender.Start(conns, input)
	case "2":
		listener.Start(conns, adj)
	}
}

func getConns(adj adj_module.ADJ) []boardpkg.BoardConn {
	conns := make([]boardpkg.BoardConn, 0)

	for _, board := range adj.Boards {
		conn := getConn(board.IP, 0, adj.Info.Addresses["backend"], adj.Info.Ports["UDP"])
		conns = append(conns, boardpkg.BoardConn{
			UDPConn: conn,
			Packets: []adj_module.Packet{},
			Board:   board,
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

func getBinaryInput(msg string) string {

	fmt.Println(msg)
	var input string
	_, err := fmt.Scan(&input)
	if err != nil {
		log.Fatalf("failed to read input: %v", err)
	}

	for {
		input = strings.TrimSpace(input)
		if input != "1" && input != "2" {
			log.Fatal("invalid input: use 1 or 2")
		} else {
			break
		}
	}
	return input
}
