package main

import (
	"fmt"
	"os"
	"runtime"
	"runtime/pprof"
	"strings"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/internal/adj"
	"github.com/HyperloopUPV-H8/h9-backend/internal/pod_data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
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

// createIDToBoardAndIpToBoardID builds lookup tables used to relate low-level
// identifiers to logical board information.
//
// It returns:
//  1. a map from PacketId to board name, allowing packets to be associated
//     with the board that produced them (derived from PodData).
//  2. a map from IP address to BoardId, allowing incoming connections or
//     messages to be mapped to a specific board (derived from ADJ metadata).
//
// These mappings are typically used by the broker and topics to route data,
// resolve board ownership, and correlate network-level information with
// domain-level identifiers.
func createIDToBoardAndIpToBoardID(podData pod_data.PodData, adj adj_module.ADJ) (map[abstraction.PacketId]string, map[string]abstraction.BoardId) {

	idToBoard := make(map[abstraction.PacketId]string)
	for _, board := range podData.Boards {
		for _, packet := range board.Packets {
			idToBoard[packet.Id] = board.Name
		}
	}

	ipToBoardID := make(map[string]abstraction.BoardId)
	for name, ip := range adj.Info.Addresses {
		ipToBoardID[ip] = abstraction.BoardId(adj.Info.BoardIds[name])
	}

	return idToBoard, ipToBoardID
}
