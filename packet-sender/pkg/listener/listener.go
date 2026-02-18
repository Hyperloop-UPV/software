package listener

import (
	"encoding/binary"
	"fmt"
	"log"
	"net"
	boardpkg "packet_sender/pkg/board"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/pkg/adj"
)

func Start(conns []boardpkg.BoardConn, adj adj_module.ADJ) {
	tcpPort := adj.Info.Ports["TCP_SERVER"]
	for i := range conns {
		if err := startTCPListener(&conns[i], tcpPort); err != nil {
			log.Printf("TCP listener error: %v", err)
		}
	}

	defer func() {
		for _, c := range conns {
			if c.TCPConn != nil {
				c.TCPConn.Close()
			}
			if c.TCPListener != nil {
				c.TCPListener.Close()
			}
		}
	}()

	// Get the list of packets for each board
	for i := range conns {
		boardpkg.LoadDataPackets(&conns[i])
		go startTCPConnection(&conns[i])
	}

	select {}
}

func startTCPListener(board *boardpkg.BoardConn, backendPort uint16) error {

	addr, err := net.ResolveTCPAddr("tcp", fmt.Sprintf("%s:%d", board.Board.IP, backendPort))
	if err != nil {
		return fmt.Errorf("resolve tcp addr for %s: %w", board.Board.Name, err)
	}

	ln, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen tcp for %s: %w", board.Board.Name, err)
	}

	board.TCPListener = ln
	log.Printf("[%s] TCP listening on %s", board.Board.Name, ln.Addr().String())
	return nil
}

func startTCPConnection(board *boardpkg.BoardConn) {
	if board.TCPListener == nil {
		return
	}

	conn, err := board.TCPListener.AcceptTCP()
	if err != nil {
		log.Printf("[%s] TCP accept error: %v", board.Board.Name, err)
		return
	}

	board.TCPConn = conn
	log.Printf("[%s] TCP connected: local=%s remote=%s",
		board.Board.Name, conn.LocalAddr().String(), conn.RemoteAddr().String())

	go readTCPPackets(board)
}

func readTCPPackets(board *boardpkg.BoardConn) {
	if board.TCPConn == nil {
		return
	}

	buf := make([]byte, 2048)

	// Read packets in a loop
	for {
		n, err := board.TCPConn.Read(buf)
		if err != nil {
			log.Printf("[%s] TCP read closed/error: %v", board.Board.Name, err)
			return
		}
		if n < 2 {
			log.Printf("[%s] TCP read %d bytes (too short for packet id)", board.Board.Name, n)
			continue
		}

		id := binary.LittleEndian.Uint16(buf[:2])
		order := findOrderByID(board, id)
		log.Printf("[%s] TCP: packet_id=%d order=%s", board.Board.Name, id, order)
	}
}

func findOrderByID(board *boardpkg.BoardConn, id uint16) string {
	for _, p := range board.Board.Packets {
		if uint16(p.Id) == id {
			return p.Name
		}
	}
	return "unknown"
}