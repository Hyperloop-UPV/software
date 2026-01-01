package main

import (
	"context"
	"encoding/binary"
	"fmt"
	"net"
	"time"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/internal/adj"
	"github.com/HyperloopUPV-H8/h9-backend/internal/common"
	"github.com/HyperloopUPV-H8/h9-backend/internal/config"

	"github.com/HyperloopUPV-H8/h9-backend/internal/pod_data"
	"github.com/HyperloopUPV-H8/h9-backend/internal/utils"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/boards"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/tcp"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/udp"
	blcu_packet "github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/blcu"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/protection"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/presentation"
	trace "github.com/rs/zerolog/log"
)

func configureTransport(
	adj adj_module.ADJ,
	podData pod_data.PodData,
	transp *transport.Transport,
	config config.Config,
) {

	decoder, encoder := getTransportDecEnc(adj.Info, podData)
	transp.WithDecoder(decoder).WithEncoder(encoder)

	// Set package id to target map
	for _, board := range podData.Boards {
		for _, packet := range board.Packets {
			transp.SetIdTarget(abstraction.PacketId(packet.Id), abstraction.TransportTarget(board.Name))
		}
		transp.SetTargetIp(adj.Info.Addresses[board.Name], abstraction.TransportTarget(board.Name))
	}

	// Set BLCU packet ID mappings if BLCU is configured
	if common.Contains(config.Vehicle.Boards, "BLCU") {
		// Use configurable packet IDs or defaults
		downloadOrderId := config.Blcu.DownloadOrderId
		uploadOrderId := config.Blcu.UploadOrderId
		if downloadOrderId == 0 {
			downloadOrderId = boards.DefaultBlcuDownloadOrderId
		}
		if uploadOrderId == 0 {
			uploadOrderId = boards.DefaultBlcuUploadOrderId
		}

		transp.SetIdTarget(abstraction.PacketId(downloadOrderId), abstraction.TransportTarget("BLCU"))
		transp.SetIdTarget(abstraction.PacketId(uploadOrderId), abstraction.TransportTarget("BLCU"))

		// Use BLCU address from config, ADJ, or default
		blcuIP := config.Blcu.IP
		if blcuIP == "" {
			if adjBlcuIP, exists := adj.Info.Addresses[BLCU]; exists {
				blcuIP = adjBlcuIP
			} else {
				blcuIP = "127.0.0.1"
			}
		}
		transp.SetTargetIp(blcuIP, abstraction.TransportTarget("BLCU"))
	}

	// Start handling TCP client connections
	i := 0
	serverTargets := make(map[string]abstraction.TransportTarget)
	for _, board := range podData.Boards {
		if !common.Contains(config.Vehicle.Boards, board.Name) {
			serverTargets[fmt.Sprintf("%s:%d", adj.Info.Addresses[board.Name], adj.Info.Ports[TcpClient])] = abstraction.TransportTarget(board.Name)
			continue
		}
		backendTcpClientAddr, err := net.ResolveTCPAddr("tcp", fmt.Sprintf("%s:%d", adj.Info.Addresses[BACKEND], adj.Info.Ports[TcpClient]+uint16(i)))
		if err != nil {
			panic("Failed to resolve local backend TCP client address")
		}
		// Create TCP client config with custom parameters from config
		clientConfig := tcp.NewClientConfig(backendTcpClientAddr)

		// Apply custom timeout if specified
		if config.TCP.ConnectionTimeout > 0 {
			clientConfig.Timeout = time.Duration(config.TCP.ConnectionTimeout) * time.Millisecond
		}

		// Apply custom keep-alive if specified
		if config.TCP.KeepAlive > 0 {
			clientConfig.KeepAlive = time.Duration(config.TCP.KeepAlive) * time.Millisecond
		}

		// Apply custom backoff parameters
		if config.TCP.BackoffMinMs > 0 || config.TCP.BackoffMaxMs > 0 || config.TCP.BackoffMultiplier > 0 {
			minBackoff := 100 * time.Millisecond // default
			maxBackoff := 5 * time.Second        // default
			multiplier := 1.5                    // default

			if config.TCP.BackoffMinMs > 0 {
				minBackoff = time.Duration(config.TCP.BackoffMinMs) * time.Millisecond
			}
			if config.TCP.BackoffMaxMs > 0 {
				maxBackoff = time.Duration(config.TCP.BackoffMaxMs) * time.Millisecond
			}
			if config.TCP.BackoffMultiplier > 0 {
				multiplier = config.TCP.BackoffMultiplier
			}

			clientConfig.ConnectionBackoffFunction = tcp.NewExponentialBackoff(minBackoff, multiplier, maxBackoff)
		}

		// Apply max retries (0 or negative means infinite)
		clientConfig.MaxConnectionRetries = config.TCP.MaxRetries

		go transp.HandleClient(clientConfig, fmt.Sprintf("%s:%d", adj.Info.Addresses[board.Name], adj.Info.Ports[TcpServer]))
		i++
	}

	// Start handling TCP server connections
	go transp.HandleServer(tcp.ServerConfig{
		ListenConfig: net.ListenConfig{
			KeepAlive: time.Second,
		},
		Context: context.TODO(),
	}, fmt.Sprintf("%s:%d", adj.Info.Addresses[BACKEND], adj.Info.Ports[TcpServer]))

	// Start handling network packets using UDP server
	trace.Info().Msg("Starting UDP server")
	udpServer := udp.NewServer(adj.Info.Addresses[BACKEND], adj.Info.Ports[UDP], &trace.Logger)
	err := udpServer.Start()
	if err != nil {
		panic("failed to start UDP server: " + err.Error())
	}
	go transp.HandleUDPServer(udpServer)

}

func getTransportDecEnc(info adj_module.Info, podData pod_data.PodData) (*presentation.Decoder, *presentation.Encoder) {
	decoder := presentation.NewDecoder(binary.LittleEndian, trace.Logger)
	encoder := presentation.NewEncoder(binary.LittleEndian, trace.Logger)

	dataDecoder := data.NewDecoder(binary.LittleEndian)
	dataEncoder := data.NewEncoder(binary.LittleEndian)

	ids := make([]abstraction.PacketId, 0)
	for _, board := range podData.Boards {
		for _, packet := range board.Packets {
			descriptor := make(data.Descriptor, len(packet.Measurements))
			for i, measurement := range packet.Measurements {
				switch meas := measurement.(type) {
				case pod_data.NumericMeasurement:
					podOps := getOps(meas.PodUnits)
					displayOps := getOps(meas.DisplayUnits)
					switch meas.Type {
					case "uint8":
						descriptor[i] = data.NewNumericDescriptor[uint8](data.ValueName(meas.Id), podOps, displayOps)
					case "uint16":
						descriptor[i] = data.NewNumericDescriptor[uint16](data.ValueName(meas.Id), podOps, displayOps)
					case "uint32":
						descriptor[i] = data.NewNumericDescriptor[uint32](data.ValueName(meas.Id), podOps, displayOps)
					case "uint64":
						descriptor[i] = data.NewNumericDescriptor[uint64](data.ValueName(meas.Id), podOps, displayOps)
					case "int8":
						descriptor[i] = data.NewNumericDescriptor[int8](data.ValueName(meas.Id), podOps, displayOps)
					case "int16":
						descriptor[i] = data.NewNumericDescriptor[int16](data.ValueName(meas.Id), podOps, displayOps)
					case "int32":
						descriptor[i] = data.NewNumericDescriptor[int32](data.ValueName(meas.Id), podOps, displayOps)
					case "int64":
						descriptor[i] = data.NewNumericDescriptor[int64](data.ValueName(meas.Id), podOps, displayOps)
					case "float32":
						descriptor[i] = data.NewNumericDescriptor[float32](data.ValueName(meas.Id), podOps, displayOps)
					case "float64":
						descriptor[i] = data.NewNumericDescriptor[float64](data.ValueName(meas.Id), podOps, displayOps)
					default:
						panic(fmt.Sprintf("unexpected numeric type for %s: %s", meas.Id, meas.Type))
					}
				case pod_data.BooleanMeasurement:
					descriptor[i] = data.NewBooleanDescriptor(data.ValueName(meas.Id))
				case pod_data.EnumMeasurement:
					enumDescriptor := make(data.EnumDescriptor, len(meas.Options))
					for j, option := range meas.Options {
						enumDescriptor[j] = data.EnumVariant(option)
					}
					descriptor[i] = data.NewEnumDescriptor(data.ValueName(meas.Id), enumDescriptor)
				default:
					panic(fmt.Sprintf("unexpected measurement type: %T", measurement))
				}
			}
			dataDecoder.SetDescriptor(abstraction.PacketId(packet.Id), descriptor)
			dataEncoder.SetDescriptor(abstraction.PacketId(packet.Id), descriptor)
			ids = append(ids, abstraction.PacketId(packet.Id))
		}
	}

	for _, id := range ids {
		decoder.SetPacketDecoder(id, dataDecoder)
		encoder.SetPacketEncoder(id, dataEncoder)
	}

	decoder.SetPacketDecoder(abstraction.PacketId(info.MessageIds[BlcuAck]), blcu_packet.NewDecoder())

	// TODO Solve this foking mess, I have tried...
	stateOrdersDecoder := order.NewDecoder(binary.LittleEndian)
	stateOrdersDecoder.SetActionId(abstraction.PacketId(info.MessageIds[AddStateOrder]), stateOrdersDecoder.DecodeAdd)
	stateOrdersDecoder.SetActionId(abstraction.PacketId(info.MessageIds[RemoveStateOrder]), stateOrdersDecoder.DecodeRemove)
	decoder.SetPacketDecoder(abstraction.PacketId(info.MessageIds[AddStateOrder]), stateOrdersDecoder)
	decoder.SetPacketDecoder(abstraction.PacketId(info.MessageIds[RemoveStateOrder]), stateOrdersDecoder)

	protectionDecoder := protection.NewDecoder(binary.LittleEndian)
	protectionDecoder.SetSeverity(1000, protection.FaultSeverity).SetSeverity(2000, protection.WarningSeverity).SetSeverity(3000, protection.OkSeverity)
	protectionDecoder.SetSeverity(1111, protection.FaultSeverity).SetSeverity(2111, protection.WarningSeverity).SetSeverity(3111, protection.OkSeverity)
	protectionDecoder.SetSeverity(1222, protection.FaultSeverity).SetSeverity(2222, protection.WarningSeverity).SetSeverity(3222, protection.OkSeverity)
	protectionDecoder.SetSeverity(1333, protection.FaultSeverity)
	protectionDecoder.SetSeverity(1444, protection.FaultSeverity)
	protectionDecoder.SetSeverity(1555, protection.FaultSeverity).SetSeverity(2555, protection.WarningSeverity)
	protectionDecoder.SetSeverity(1666, protection.FaultSeverity).SetSeverity(2666, protection.WarningSeverity).SetSeverity(3666, protection.OkSeverity)

	// Set protection decoder for all protection packet IDs
	packetIDs := []abstraction.PacketId{
		1000, 1111, 1222, 1333,
		1444, 1555, 1666, 2000,
		2111, 2222, 2555, 2666,
		3000, 3111, 3222, 3666,
	}

	for _, id := range packetIDs {
		decoder.SetPacketDecoder(id, protectionDecoder)
	}

	return decoder, encoder
}

func getOps(units utils.Units) data.ConversionDescriptor {
	output := make(data.ConversionDescriptor, len(units.Operations))
	for i, operation := range units.Operations {
		output[i] = data.Operation{
			Operator: operation.Operator,
			Operand:  operation.Operand,
		}
	}
	return output
}
