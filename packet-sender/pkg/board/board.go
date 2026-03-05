package board

import (
	"net"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/pkg/adj"
)

type BoardConn struct {
	UDPConn *net.UDPConn
	Packets []adj_module.Packet
	Board   adj_module.Board

	TCPListener *net.TCPListener
	TCPConn     net.Conn
}

func LoadDataPackets(boardConn *BoardConn) {
	packets := make([]adj_module.Packet, 0)

	for _, packet := range boardConn.Board.Packets {
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

	boardConn.Packets = packets
}
