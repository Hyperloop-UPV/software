// Package config provides functionality for reading and parsing configuration files.
package config

import (
	"os"
	"strings"

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

	// TODO: add strict mode (DisallowUnkownFields)
	decodeErr := toml.NewDecoder(reader).Decode(&config)

	if decodeErr != nil {

		return Config{}, decodeErr
	}

	return config, nil
}
