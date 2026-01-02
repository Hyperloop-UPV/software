package main

import (
	"fmt"
	"os"
	"runtime"
	"runtime/pprof"
	"strings"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/internal/adj"
	"github.com/HyperloopUPV-H8/h9-backend/internal/config"
	"github.com/HyperloopUPV-H8/h9-backend/internal/pod_data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	data_logger "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/data"
	order_logger "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/order"
	"github.com/pkg/browser"
	trace "github.com/rs/zerolog/log"
)

// Handle version flag
func handleVersionFlag() {

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
}

// setupRuntimeCPU sets up CPU profiling if the cpuprofile flag is set.
// It also sets the maximum number of CPUs to use.
//
// Returns a cleanup function that stops the CPU profiling and closes the file,
// which should be deferred by the caller.
func setupRuntimeCPU() func() {

	cleanup := func() {}

	runtime.GOMAXPROCS(runtime.NumCPU())
	if *cpuprofile != "" {
		f, err := os.Create(*cpuprofile)
		if err != nil {
			f.Close()
			trace.Fatal().Stack().Err(err).Msg("could not set up CPU profiling")

		}
		pprof.StartCPUProfile(f)

		cleanup = func() {
			pprof.StopCPUProfile()
			f.Close()
		}
	}
	runtime.SetBlockProfileRate(*blockprofile)

	return cleanup
}

// createPacketIDToBoard builds a lookup table that maps each PacketId
// to the name of the board that produced it.
func createPacketIDToBoard(
	podData pod_data.PodData,
) map[abstraction.PacketId]string {

	idToBoard := make(map[abstraction.PacketId]string)

	for _, board := range podData.Boards {
		for _, packet := range board.Packets {
			idToBoard[packet.Id] = board.Name
		}
	}

	return idToBoard
}

// createIPToBoardID builds a lookup table that maps an IP address
// to its corresponding BoardId using ADJ metadata.
func createIPToBoardID(
	adj adj_module.ADJ,
) map[string]abstraction.BoardId {

	ipToBoardID := make(map[string]abstraction.BoardId)

	for name, ip := range adj.Info.Addresses {
		ipToBoardID[ip] = abstraction.BoardId(adj.Info.BoardIds[name])
	}

	return ipToBoardID
}

// createBoardToPackets builds a lookup table that maps each board
// to the list of PacketIds it produces.
func createBoardToPackets(
	podData pod_data.PodData,
) map[abstraction.TransportTarget][]abstraction.PacketId {

	boardToPackets := make(map[abstraction.TransportTarget][]abstraction.PacketId)

	for _, board := range podData.Boards {
		packetIds := make([]abstraction.PacketId, len(board.Packets))
		for i, packet := range board.Packets {
			packetIds[i] = packet.Id
		}
		boardToPackets[abstraction.TransportTarget(board.Name)] = packetIds
	}

	return boardToPackets
}

// createLookupTables builds all lookup tables required by the broker
// and related components.
//
// It returns:
//  1. PacketId -> board name
//  2. IP address -> BoardId
//  3. board -> PacketIds
func createLookupTables(
	podData pod_data.PodData,
	adj adj_module.ADJ,
) (
	map[abstraction.PacketId]string,
	map[string]abstraction.BoardId,
	map[abstraction.TransportTarget][]abstraction.PacketId,
) {

	return createPacketIDToBoard(podData),
		createIPToBoardID(adj),
		createBoardToPackets(podData)
}

func setUpLogger(config config.Config) (*logger.Logger, SubloggersMap) {

	var subloggers = SubloggersMap{
		data_logger.Name:  data_logger.NewLogger(),
		order_logger.Name: order_logger.NewLogger(),
	}

	logger.ConfigureLogger(config.Logging.TimeUnit, config.Logging.LoggingPath)
	loggerHandler := logger.NewLogger(subloggers, trace.Logger)

	return loggerHandler, subloggers

}

func openBrowserTabs(config config.Config) {

	switch config.App.AutomaticWindowOpening {
	case "ethernet-view":
		browser.OpenURL("http://" + config.Server["ethernet-view"].Addr)
	case "control-station":
		browser.OpenURL("http://" + config.Server["control-station"].Addr)
	case "both":
		browser.OpenURL("http://" + config.Server["ethernet-view"].Addr)
		browser.OpenURL("http://" + config.Server["control-station"].Addr)
	}
}
