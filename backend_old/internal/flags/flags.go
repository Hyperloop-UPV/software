// Package flags defines command-line flags for the backend application.
package flags

import "flag"

var (

	// ConfigFile specifies the path to the configuration file.
	ConfigFile string
	// ConfigAllowUnknown enables non-strict mode for configuration parsing.
	ConfigAllowUnknown bool

	// TraceLevel sets the logging level for tracing.
	TraceLevel string
	// TraceFile specifies the file to write trace logs to.
	TraceFile string

	// CPUProfile specifies the file to write CPU profiling data to.
	CPUProfile string
	// EnableSNTP enables a simple SNTP server on port 123.
	EnableSNTP bool
	// BlockProfile sets the number of block profiles to include.
	BlockProfile int
	// Version shows the backend version when set.
	Version bool
	// EnableLooger enables logging (note: likely a typo for "Logger").
	EnableLooger bool
)

// Init sets up the command-line flags with their default values and descriptions.
func Init() {
	flag.StringVar(&ConfigFile, "config", "config.toml", "path to configuration file")
	flag.BoolVar(&ConfigAllowUnknown, "config-allow-unknown", false, "allow unknown fields in configuration file")
	flag.StringVar(&TraceLevel, "trace", "info", "set the trace level (\"fatal\", \"error\", \"warn\", \"info\", \"debug\", \"trace\")")
	flag.StringVar(&CPUProfile, "cpuprofile", "", "write cpu profile to file")
	flag.BoolVar(&EnableSNTP, "sntp", false, "enables a simple SNTP server on port 123")
	flag.IntVar(&BlockProfile, "blockprofile", 0, "number of block profiles to include")
	flag.BoolVar(&Version, "version", false, "Show the backend version")
	flag.BoolVar(&EnableLooger, "L", false, "enable logging")

	flag.Parse()
}
