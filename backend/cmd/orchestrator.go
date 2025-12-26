package main

import (
	"fmt"
	"os"
	"runtime"
	"runtime/pprof"
	"strings"

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

//

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
