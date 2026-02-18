package transport

import (
	"net"
	"sync"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/tftp"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/presentation"
	"github.com/rs/zerolog"
)

func NewTransport(baseLogger zerolog.Logger) *Transport {
	transport := &Transport{
		connectionsMx: &sync.Mutex{},
		connections:   make(map[abstraction.TransportTarget]net.Conn),
		idToTarget:    make(map[abstraction.PacketId]abstraction.TransportTarget),
		ipToTarget:    make(map[string]abstraction.TransportTarget),

		logger:  baseLogger,
		errChan: make(chan error, 100),
	}
	go transport.consumeErrors()
	return transport
}

func (transport *Transport) WithDecoder(decoder *presentation.Decoder) *Transport {
	transport.decoder = decoder
	transport.logger.Trace().Msg("set decoder")
	return transport
}

func (transport *Transport) WithEncoder(encoder *presentation.Encoder) *Transport {
	transport.encoder = encoder
	transport.logger.Trace().Msg("set encoder")
	return transport
}

func (transport *Transport) WithTFTP(client *tftp.Client) *Transport {
	transport.tftp = client
	transport.logger.Trace().Msg("set TFTP")
	return transport
}

func (transport *Transport) SetIdTarget(id abstraction.PacketId, target abstraction.TransportTarget) *Transport {
	transport.idToTarget[id] = target
	transport.logger.Trace().Uint16("id", uint16(id)).Str("target", string(target)).Msg("set id for target")
	return transport
}

func (transport *Transport) SetTargetIp(ip string, target abstraction.TransportTarget) *Transport {
	transport.ipToTarget[ip] = target
	transport.logger.Trace().Str("ip", ip).Str("target", string(target)).Msg("set ip for target")
	return transport
}
