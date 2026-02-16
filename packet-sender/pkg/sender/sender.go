package sender

import (
	boardpkg "packet_sender/pkg/board"
)

func Start(conns []boardpkg.BoardConn, input string) {

	// Get the list of packets for each board
	for i := range conns {
		boardpkg.LoadDataPackets(&conns[i])
	}

	defer func() {
		for _, c := range conns {
			c.UDPConn.Close()
		}
	}()

	switch input {
	case "1":
		RandomSender(conns)
	case "2":
		CustomSender(conns)
	}
}
