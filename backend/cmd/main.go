package main

import (
	"flag"
	_ "net/http/pprof"
	"os"
	"os/signal"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/internal/adj"
	"github.com/HyperloopUPV-H8/h9-backend/internal/config"
	"github.com/HyperloopUPV-H8/h9-backend/internal/pod_data"
	"github.com/HyperloopUPV-H8/h9-backend/internal/update_factory"
	vehicle_models "github.com/HyperloopUPV-H8/h9-backend/internal/vehicle/models"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport"
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

	// Set use to all available CPUs and setup CPU profiling if enabled
	cleanup := setupRuntimeCPU()
	defer cleanup()

	// <--- config --->
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

	// <--- vehicle orders --->
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

	// <-- connections & upgrader -->
	connections := make(chan *websocket.Client)
	upgrader := websocket.NewUpgrader(connections, trace.Logger)

	// <--- broker --->
	broker, cleanup := configureBroker(subloggers, loggerHandler, idToBoard, connections)
	defer cleanup()

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
	configureTransport(
		adj,
		podData,
		transp,
		config,
	)

	// <--- http server --->
	configureHttpServer(
		adj,
		podData,
		vehicleOrders,
		upgrader,
		config,
	)

	// <--- SNTP --->
	terminate := configureSNTP(adj)
	if terminate {
		os.Exit(1)
	}

	// Open browser tabs
	openBrowserTabs(config)

	// Wait for interrupt signal to gracefully shutdown the backend
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)
	defer signal.Stop(interrupt)

	<-interrupt
	trace.Info().Msg("shutting down backend")
}

// <-- Hall of Fame -->
// H09 -- Zürich    -- PM Juan Martínez, Marc Sanchis -- Winners
// H10 -- Groningen -- PM Marc Sanchis, Joan Física   -- 3rd Place
