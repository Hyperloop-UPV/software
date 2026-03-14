// Package validator provides logging utilities for the ADJ Validator component.
package validator

import (
	"fmt"
	"path"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	loggerbase "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/base"

	loggerHandler "github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	trace "github.com/rs/zerolog/log"
)

const (
	Validator abstraction.LoggerName = "adj_validator"
)

// LogADJValidatorOutput logs in a TXT file the output of the ADJ Validator.
func LogADJValidatorOutput(output []byte) {

	// Directory of trace
	traceDir := loggerHandler.BasePath

	// Use current time in filename to avoid collisions
	timestamp := loggerHandler.StartAppTimestamp.Format(loggerHandler.TimestampFormat)

	traceFile := path.Join(
		"others",
		fmt.Sprintf("adj-validator-%s.txt", timestamp),
	)

	// Create file
	file, err := loggerbase.CreateFile(traceDir, Validator, traceFile)
	if err != nil {
		trace.Error().Err(err).Msg("Failed to create ADJ Validator log file")
		return
	}
	defer file.Close()

	// Write the output to the file
	if _, err := file.Write(output); err != nil {
		trace.Error().Err(err).Msg("Failed to write ADJ Validator output to log file")
		return
	}

	trace.Debug().Msgf("ADJ Validator output logged to %s", file.Name())

}
