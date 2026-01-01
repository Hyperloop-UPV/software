package main

import (
	"context"
	"encoding/binary"
	"flag"
	"fmt"
	"net"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"time"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/internal/adj"
	"github.com/HyperloopUPV-H8/h9-backend/internal/common"
	"github.com/HyperloopUPV-H8/h9-backend/internal/config"
	"github.com/HyperloopUPV-H8/h9-backend/internal/pod_data"
	"github.com/HyperloopUPV-H8/h9-backend/internal/update_factory"
	"github.com/HyperloopUPV-H8/h9-backend/internal/utils"
	vehicle_models "github.com/HyperloopUPV-H8/h9-backend/internal/vehicle/models"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/boards"
	blcu_topics "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/blcu"
	h "github.com/HyperloopUPV-H8/h9-backend/pkg/http"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/tcp"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/udp"
	blcu_packet "github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/blcu"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/protection"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/presentation"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	trace "github.com/rs/zerolog/log"
)

const (
	BACKEND          = "backend"
	BLCU             = "BLCU"
	TcpClient        = "TCP_CLIENT"
	TcpServer        = "TCP_SERVER"
	UDP              = "UDP"
	SNTP             = "SNTP"
	BlcuAck          = "blcu_ack"
	AddStateOrder    = "add_state_order"
	RemoveStateOrder = "remove_state_order"
)

var configFile = flag.String("config", "config.toml", "path to configuration file")
var traceLevel = flag.String("trace", "info", "set the trace level (\"fatal\", \"error\", \"warn\", \"info\", \"debug\", \"trace\")")
var traceFile = flag.String("log", "", "set the trace log file")
var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")
var enableSNTP = flag.Bool("sntp", false, "enables a simple SNTP server on port 123")
var networkDevice = flag.Int("dev", -1, "index of the network device to use, overrides device prompt")
var blockprofile = flag.Int("blockprofile", 0, "number of block profiles to include")
var playbackFile = flag.String("playback", "", "")
var versionFlag = flag.Bool("version", false, "Show the backend version")

type SubloggersMap map[abstraction.LoggerName]abstraction.Logger

func main() {
	// Parse command line flags
	flag.Parse()

	handleVersionFlag()

	// Configure trace
	traceFile := initTrace(*traceLevel, *traceFile)
	if traceFile != nil {
		defer traceFile.Close()
	}

	//! Does not guarante that os.TempDir() is always the same
	// pidPath := path.Join(os.TempDir(), "backendPid")
	// createPid(pidPath)
	// defer RemovePid(pidPath)

	// Set use to all available CPUs and setup CPU profiling if enabled
	cleanup := setupRuntimeCPU()
	defer cleanup()

	// Load configuration file
	config, err := config.GetConfig(*configFile)
	if err != nil {
		trace.Fatal().Err(err).Msg("error unmarshaling toml file")
	}

	// <--- ADJ --->
	adj, err := adj_module.NewADJ(config.Adj.Branch)
	if err != nil {
		trace.Fatal().Err(err).Msg("setting up ADJ")
	}

	// <--- pod data --->
	podData, err := pod_data.NewPodData(adj.Boards, adj.Info.Units)
	if err != nil {
		trace.Fatal().Err(err).Msg("creating podData")
	}

	vehicleOrders, err := vehicle_models.NewVehicleOrders(podData.Boards, adj.Info.Addresses[BLCU])
	if err != nil {
		trace.Fatal().Err(err).Msg("creating vehicleOrders")
	}

	// <-- lookup tables -->

	idToBoard, ipToBoardID, boardToPackets := createLookupTables(podData, adj)

	// <--- update factory --->

	updateFactory := update_factory.NewFactory(boardToPackets)

	// <--- logger --->
	loggerHandler, subloggers := setUpLogger(config)

	// <--- broker --->

	broker, cleanup := configureBroker(subloggers, loggerHandler, idToBoard)
	defer cleanup()

	connections := make(chan *websocket.Client)
	upgrader := websocket.NewUpgrader(connections, trace.Logger)
	pool := websocket.NewPool(connections, trace.Logger)
	broker.SetPool(pool)
	blcu_topics.RegisterTopics(broker, pool)

	// <--- transport --->
	transp := transport.NewTransport(trace.Logger)
	transp.SetpropagateFault(config.Transport.PropagateFault)

	// <--- vehicle --->

	err = configureVehicle(
		broker,
		loggerHandler,
		updateFactory,
		ipToBoardID,
		idToBoard,
		transp,
		adj,
		config,
	)
	if err != nil {
		trace.Err(err).Msg("configuring vehicle")
	}

	// <--- transport --->
	// Load and set packet decoder and encoder
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

	// Start handling network packets (either sniffer or UDP server based on dev mode)
	// Dev mode: Use UDP server
	trace.Info().Msg("Starting UDP server")
	udpServer := udp.NewServer(adj.Info.Addresses[BACKEND], adj.Info.Ports[UDP], &trace.Logger)
	err = udpServer.Start()
	if err != nil {
		panic("failed to start UDP server: " + err.Error())
	}
	go transp.HandleUDPServer(udpServer)

	// <--- http server --->
	podDataHandle, err := h.HandleDataJSON("podData.json", pod_data.GetDataOnlyPodData(podData))
	if err != nil {
		fmt.Fprintf(os.Stderr, "error creating podData handler: %v\n", err)
	}
	orderDataHandle, err := h.HandleDataJSON("orderData.json", vehicleOrders)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error creating orderData handler: %v\n", err)
	}
	uploadableBords := common.Filter(common.Keys(adj.Info.Addresses), func(item string) bool {
		return item != adj.Info.Addresses[BLCU]
	})
	programableBoardsHandle, err := h.HandleDataJSON("programableBoards.json", uploadableBords)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error creating programableBoards handler: %v\n", err)
	}

	for _, server := range config.Server {
		mux := h.NewMux(
			h.Endpoint("/backend"+server.Endpoints.PodData, podDataHandle),
			h.Endpoint("/backend"+server.Endpoints.OrderData, orderDataHandle),
			h.Endpoint("/backend"+server.Endpoints.ProgramableBoards, programableBoardsHandle),
			h.Endpoint(server.Endpoints.Connections, upgrader),
			h.Endpoint(server.Endpoints.Files, h.HandleStatic(server.StaticPath)),
		)

		httpServer := h.NewServer(server.Addr, mux)
		go httpServer.ListenAndServe()
	}

	go http.ListenAndServe("127.0.0.1:4040", nil)

	// <--- SNTP --->
	terminate := configureSNTP(adj)
	if terminate {
		os.Exit(1)
	}

	// Open browser tabs
	openBrowserTabs(config)

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)
	defer signal.Stop(interrupt)

	<-interrupt
	trace.Info().Msg("shutting down backend")

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

	// TODO Solve this foking mess
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
	decoder.SetPacketDecoder(1000, protectionDecoder)
	decoder.SetPacketDecoder(1111, protectionDecoder)
	decoder.SetPacketDecoder(1222, protectionDecoder)
	decoder.SetPacketDecoder(1333, protectionDecoder)
	decoder.SetPacketDecoder(1444, protectionDecoder)
	decoder.SetPacketDecoder(1555, protectionDecoder)
	decoder.SetPacketDecoder(1666, protectionDecoder)
	decoder.SetPacketDecoder(2000, protectionDecoder)
	decoder.SetPacketDecoder(2111, protectionDecoder)
	decoder.SetPacketDecoder(2222, protectionDecoder)
	decoder.SetPacketDecoder(2555, protectionDecoder)
	decoder.SetPacketDecoder(2666, protectionDecoder)
	decoder.SetPacketDecoder(3000, protectionDecoder)
	decoder.SetPacketDecoder(3111, protectionDecoder)
	decoder.SetPacketDecoder(3222, protectionDecoder)
	decoder.SetPacketDecoder(3666, protectionDecoder)

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

// H09 -- Zürich    -- PM Juan Martínez, Marc Sanchis -- Winners
// H10 -- Groningen -- PM Marc Sanchis, Joan Física   -- ???
