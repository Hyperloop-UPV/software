// Package config provides functionality for reading and parsing configuration files.
package config

import (
	"os"
	"strings"

	"github.com/HyperloopUPV-H8/h9-backend/internal/flags"
	"github.com/pelletier/go-toml/v2"
	trace "github.com/rs/zerolog/log"
)

// GetConfig reads the configuration from the specified TOML file path
// and unmarshals it into a Config struct.
func GetConfig(path string) (Config, error) {
	configFile, fileErr := os.ReadFile(path)

	if fileErr != nil {
		trace.Fatal().Stack().Err(fileErr).Msg("error reading config file")
	}

	reader := strings.NewReader(string(configFile))

	var config Config

	decode := toml.NewDecoder(reader)

	// Set whether to disallow unknown fields based on the flag
	if !flags.ConfigAllowUnknown {
		decode.DisallowUnknownFields()
	}
	decodeErr := decode.Decode(&config)

	if decodeErr != nil {

		return Config{}, decodeErr
	}

	return config, nil
}
