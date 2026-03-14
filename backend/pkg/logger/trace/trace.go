// Package tracelogger provides initialization and configuration for trace-level logging using zerolog.
package tracelogger

import (
	"fmt"
	"os"
	"path"
	"strconv"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	loggerHandler "github.com/HyperloopUPV-H8/h9-backend/pkg/logger"

	loggerbase "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/base"
	"github.com/rs/zerolog"
	trace "github.com/rs/zerolog/log"
	"github.com/rs/zerolog/pkgerrors"
)

const (
	Trace abstraction.LoggerName = "trace"
)

// traceLevelMap maps human-readable level names to zerolog levels.
// Valid keys are: "fatal", "error", "warn", "info", "debug", "trace", and "disabled".
var traceLevelMap = map[string]zerolog.Level{
	"fatal":    zerolog.FatalLevel,
	"error":    zerolog.ErrorLevel,
	"warn":     zerolog.WarnLevel,
	"info":     zerolog.InfoLevel,
	"debug":    zerolog.DebugLevel,
	"trace":    zerolog.TraceLevel,
	"disabled": zerolog.Disabled,
}

// initTrace configures zerolog for the application.
// It sets formatting options, creates the trace output file and a console writer,
// configures a multi-writer so logs are written to both stdout and the file,
// and sets the global log level based on the provided traceLevel string.
//
// Parameters:
// - traceLevel: human-friendly level name (see traceLevelMap)
//
// Returns the opened *os.File for the trace file so the caller can close it later,
// or nil if an error occurred while creating the file or if the level is invalid.
func InitTrace(traceLevel string) *os.File {

	// Directory of trace
	traceDir := loggerHandler.BasePath

	// Use current time in filename to avoid collisions
	timestamp := time.Now().Format(loggerHandler.TimestampFormat)

	traceFile := path.Join(
		"others",
		fmt.Sprintf("trace-%s.json", timestamp),
	)

	// Format the caller as "file:line" instead of the default format.
	zerolog.CallerMarshalFunc = func(pc uintptr, file string, line int) string {
		return file + ":" + strconv.Itoa(line)
	}

	// Use Unix nanoseconds for timestamps to ensure high-resolution time fields.
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixNano

	// Use pkgerrors to marshal error stacks into the log output.
	zerolog.ErrorStackMarshaler = pkgerrors.MarshalStack

	// Human-friendly console writer that prints logs to stdout.
	consoleWriter := zerolog.ConsoleWriter{Out: os.Stdout}

	// Try to create/open the file for writing logs. On failure, fall back to console only and exit.
	file, err := loggerbase.CreateFile(traceDir, Trace, traceFile)
	if err != nil {
		// Keep logger configured to write to console and log the fatal error.
		trace.Logger = trace.Logger.Output(consoleWriter)
		trace.Fatal().Stack().Err(err).Msg("")
		return nil
	}

	// Write logs to both the console and the file.
	multi := zerolog.MultiLevelWriter(consoleWriter, file)

	// Create a new logger that includes timestamps and caller information.
	trace.Logger = zerolog.New(multi).With().Timestamp().Caller().Logger()

	// Validate and set the chosen log level.
	if level, ok := traceLevelMap[traceLevel]; ok {
		zerolog.SetGlobalLevel(level)
	} else {
		// If the provided level is invalid, log a fatal message, close the file and return nil.
		trace.Fatal().Msg("invalid log level selected")
		file.Close()
		return nil
	}

	return file
}
