package main

import (
	"context"
	"encoding/binary"
	"flag"
	"fmt"
	"os/signal"
	"time"

	"log"
	"net"
	"net/http"
	_ "net/http/pprof"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"runtime/pprof"

	"strings"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/internal/adj"
	"github.com/HyperloopUPV-H8/h9-backend/internal/common"
	"github.com/HyperloopUPV-H8/h9-backend/internal/pod_data"
	"github.com/HyperloopUPV-H8/h9-backend/internal/update_factory"
	"github.com/HyperloopUPV-H8/h9-backend/internal/utils"
	vehicle_models "github.com/HyperloopUPV-H8/h9-backend/internal/vehicle/models"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/boards"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker"
	blcu_topics "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/blcu"
	connection_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/connection"
	data_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/data"
	logger_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/logger"
	message_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/message"
	order_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/order"
	h "github.com/HyperloopUPV-H8/h9-backend/pkg/http"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	data_logger "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/data"
	order_logger "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/tcp"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/udp"
	blcu_packet "github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/blcu"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/protection"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/presentation"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/vehicle"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"

	"github.com/jmaralo/sntp"
	"github.com/pelletier/go-toml/v2"
	"github.com/pkg/browser"
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

func main() {
	// Parse command line flags
	flag.Parse()

	// Handle version flag
	if *versionFlag {
		versionFile := "VERSION.txt"
		versionData, err := os.ReadFile(versionFile)
		if err == nil {
			fmt.Println("Hyperloop UPV Backend Version:", strings.TrimSpace(string(versionData)))
		} else {
			fmt.Println("Hyperloop UPV Backend Version: unknown")
		}
		os.Exit(0)
	}

	tracePath := *traceFile
	if tracePath == "" {
		configDir, err := os.UserConfigDir()
		if err != nil {
			// fallback to current directory if user config dir is unavailable
			configDir = "."
		}
		traceDir := filepath.Join(configDir, "hyperloop-control-station")
		// Ensure directory exists
		_ = os.MkdirAll(traceDir, 0o755)
		// Use current time in filename to avoid collisions
		timestamp := time.Now().Format("20060102T150405")
		tracePath = filepath.Join(traceDir, fmt.Sprintf("trace-%s.json", timestamp))
	}

	traceFile := initTrace(*traceLevel, tracePath)
	if traceFile != nil {
		defer traceFile.Close()
	}

	pidPath := path.Join(os.TempDir(), "backendPid")

	createPid(pidPath)
	defer RemovePid(pidPath)

	runtime.GOMAXPROCS(runtime.NumCPU())
	if *cpuprofile != "" {
		f, err := os.Create(*cpuprofile)
		if err != nil {
			log.Fatal(err)
		}
		pprof.StartCPUProfile(f)
		defer pprof.StopCPUProfile()
	}
	runtime.SetBlockProfileRate(*blockprofile)

	config := getConfig(*configFile)

	// <--- ADJ --->

	adj, err := adj_module.NewADJ(config.Adj.Branch)
	if err != nil {
		trace.Fatal().Err(err).Msg("setting up ADJ")
	}

	podData, err := pod_data.NewPodData(adj.Boards, adj.Info.Units)
	if err != nil {
		fmt.Println(err)
		trace.Fatal().Err(err).Msg("creating podData")
	}

	vehicleOrders, err := vehicle_models.NewVehicleOrders(podData.Boards, adj.Info.Addresses[BLCU])
	if err != nil {
		trace.Fatal().Err(err).Msg("creating vehicleOrders")
	}

	// <--- update factory --->
	boardToPackets := make(map[abstraction.TransportTarget][]uint16)
	for _, board := range podData.Boards {
		packetIds := make([]uint16, len(board.Packets))
		for i, packet := range board.Packets {
			packetIds[i] = packet.Id
		}
		boardToPackets[abstraction.TransportTarget(board.Name)] = packetIds
	}
	updateFactory := update_factory.NewFactory(boardToPackets)

	// <--- logger --->
	var subloggers = map[abstraction.LoggerName]abstraction.Logger{
		data_logger.Name:  data_logger.NewLogger(),
		order_logger.Name: order_logger.NewLogger(),
	}

	logger.ConfigureLogger(config.Logging.TimeUnit, config.Logging.LoggingPath)
	loggerHandler := logger.NewLogger(subloggers, trace.Logger)

	// <--- order transfer --->
	idToBoard := make(map[uint16]string)
	for _, board := range podData.Boards {
		for _, packet := range board.Packets {
			idToBoard[packet.Id] = board.Name
		}
	}

	// <--- broker --->
	broker := broker.New(trace.Logger)

	dataTopic := data_topic.NewUpdateTopic(time.Second / 10)
	defer dataTopic.Stop()
	connectionTopic := connection_topic.NewUpdateTopic()
	orderTopic := order_topic.NewSendTopic()
	loggerTopic := logger_topic.NewEnableTopic()
	loggerTopic.SetDataLogger(subloggers[data_logger.Name].(*data_logger.Logger))
	loggerHandler.SetOnStart(func() {
		if err := loggerTopic.NotifyStarted(); err != nil {
			trace.Error().Err(err).Msg("failed to notify logger started")
		}
	})

	messageTopic := message_topic.NewUpdateTopic()
	stateOrderTopic := order_topic.NewState(idToBoard, trace.Logger)

	broker.AddTopic(data_topic.UpdateName, dataTopic)
	broker.AddTopic(connection_topic.UpdateName, connectionTopic)
	broker.AddTopic(order_topic.SendName, orderTopic)
	broker.AddTopic(order_topic.StateName, stateOrderTopic)
	broker.AddTopic(logger_topic.EnableName, loggerTopic)
	broker.AddTopic(logger_topic.ResponseName, loggerTopic)
	broker.AddTopic(logger_topic.VariablesName, loggerTopic)
	broker.AddTopic(message_topic.UpdateName, messageTopic)

	connections := make(chan *websocket.Client)
	upgrader := websocket.NewUpgrader(connections, trace.Logger)
	pool := websocket.NewPool(connections, trace.Logger)
	broker.SetPool(pool)
	blcu_topics.RegisterTopics(broker, pool)

	// <--- transport --->
	transp := transport.NewTransport(trace.Logger)
	transp.SetpropagateFault(config.Transport.PropagateFault)

	// <--- vehicle --->
	ipToBoardId := make(map[string]abstraction.BoardId)
	for name, ip := range adj.Info.Addresses {
		ipToBoardId[ip] = abstraction.BoardId(adj.Info.BoardIds[name])
	}

	vehicle := vehicle.New(trace.Logger)
	vehicle.SetBroker(broker)
	vehicle.SetLogger(loggerHandler)
	vehicle.SetUpdateFactory(updateFactory)
	vehicle.SetIpToBoardId(ipToBoardId)
	vehicle.SetIdToBoardName(idToBoard)
	vehicle.SetTransport(transp)

	// <--- BLCU Board --->
	// Register BLCU board for handling bootloader operations
	if blcuIP, exists := adj.Info.Addresses[BLCU]; exists {
		blcuId, idExists := adj.Info.BoardIds["BLCU"]
		if !idExists {
			trace.Error().Msg("BLCU IP found in ADJ but board ID missing")
		} else {
			// Get configurable order IDs or use defaults
			downloadOrderId := config.Blcu.DownloadOrderId
			uploadOrderId := config.Blcu.UploadOrderId
			if downloadOrderId == 0 {
				downloadOrderId = boards.DefaultBlcuDownloadOrderId
			}
			if uploadOrderId == 0 {
				uploadOrderId = boards.DefaultBlcuUploadOrderId
			}

			tftpConfig := boards.TFTPConfig{
				BlockSize:      config.TFTP.BlockSize,
				Retries:        config.TFTP.Retries,
				TimeoutMs:      config.TFTP.TimeoutMs,
				BackoffFactor:  config.TFTP.BackoffFactor,
				EnableProgress: config.TFTP.EnableProgress,
			}
			blcuBoard := boards.NewWithConfig(blcuIP, tftpConfig, abstraction.BoardId(blcuId), downloadOrderId, uploadOrderId)
			vehicle.AddBoard(blcuBoard)
			vehicle.SetBlcuId(abstraction.BoardId(blcuId))
			trace.Info().Str("ip", blcuIP).Int("id", int(blcuId)).Uint16("download_order_id", downloadOrderId).Uint16("upload_order_id", uploadOrderId).Msg("BLCU board registered")
		}
	} else {
		trace.Warn().Msg("BLCU not found in ADJ configuration - bootloader operations unavailable")
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
	if *enableSNTP {
		sntpAddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", adj.Info.Addresses[BACKEND], adj.Info.Ports[SNTP]))
		if err != nil {
			fmt.Fprintf(os.Stderr, "error resolving sntp address: %v\n", err)
			os.Exit(1)
		}
		sntpServer, err := sntp.NewUnicast("udp", sntpAddr)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error creating sntp server: %v\n", err)
			os.Exit(1)
		}

		go func() {
			err := sntpServer.ListenAndServe()
			if err != nil {
				fmt.Fprintf(os.Stderr, "error listening sntp server: %v\n", err)
				return
			}
		}()
	}

	// Open browser tabs
	switch config.App.AutomaticWindowOpening {
	case "ethernet-view":
		browser.OpenURL("http://" + config.Server["ethernet-view"].Addr)
	case "control-station":
		browser.OpenURL("http://" + config.Server["control-station"].Addr)
	case "both":
		browser.OpenURL("http://" + config.Server["ethernet-view"].Addr)
		browser.OpenURL("http://" + config.Server["control-station"].Addr)
	}

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	for range interrupt {
		trace.Info().Msg("Shutting down")
		return
	}
}

func createPid(path string) {
	err := WritePid(path)

	if err != nil {
		switch err {
		case ErrProcessRunning:
			trace.Fatal().Err(err).Msg("Backend is already running")
		default:
			trace.Error().Err(err).Msg("pid error")
		}
	}
}

func getConfig(path string) Config {
	configFile, fileErr := os.ReadFile(path)

	if fileErr != nil {
		trace.Fatal().Stack().Err(fileErr).Msg("error reading config file")
	}

	reader := strings.NewReader(string(configFile))

	var config Config

	// TODO: add strict mode (DisallowUnkownFields)
	decodeErr := toml.NewDecoder(reader).Decode(&config)

	if decodeErr != nil {
		trace.Fatal().Stack().Err(decodeErr).Msg("error unmarshaling toml file")
	}

	return config
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
