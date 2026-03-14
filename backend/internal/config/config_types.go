package config

import (
	"github.com/HyperloopUPV-H8/h9-backend/internal/server"
	"github.com/HyperloopUPV-H8/h9-backend/internal/vehicle"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
)

type App struct {
	AutomaticWindowOpening string `toml:"automatic_window_opening"`
}

type Adj struct {
	Branch   string `toml:"branch"`
	Validate bool   `toml:"validate"`
}

type Transport struct {
	PropagateFault bool `toml:"propagate_fault"`
}

type TFTP struct {
	BlockSize      int  `toml:"block_size"`
	Retries        int  `toml:"retries"`
	TimeoutMs      int  `toml:"timeout_ms"`
	BackoffFactor  int  `toml:"backoff_factor"`
	EnableProgress bool `toml:"enable_progress"`
}

type TCP struct {
	BackoffMinMs      int     `toml:"backoff_min_ms"`
	BackoffMaxMs      int     `toml:"backoff_max_ms"`
	BackoffMultiplier float64 `toml:"backoff_multiplier"`
	MaxRetries        int     `toml:"max_retries"`
	ConnectionTimeout int     `toml:"connection_timeout_ms"`
	KeepAlive         int     `toml:"keep_alive_ms"`
}

type Logging struct {
	TimeUnit    logger.TimeUnit `toml:"time_unit"`
	LoggingPath string          `toml:"logging_path"`
}

type Config struct {
	App       App
	Vehicle   vehicle.Config
	Server    server.Config
	Adj       Adj
	Transport Transport
	TFTP      TFTP
	TCP       TCP
	Logging   Logging
}
