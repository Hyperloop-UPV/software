package config

import (
	"github.com/HyperloopUPV-H8/h9-backend/internal/server"
	"github.com/HyperloopUPV-H8/h9-backend/internal/vehicle"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
)

type Adj struct {
	Branch   string `toml:"branch"`
	Validate bool   `toml:"validate"`
}

type Transport struct {
	PropagateFault bool `toml:"propagate_fault"`
}

type TCP struct {
	BackoffMinMs      int     `toml:"backoff_min_ms"`
	BackoffMaxMs      int     `toml:"backoff_max_ms"`
	BackoffMultiplier float64 `toml:"backoff_multiplier"`
	MaxRetries        int     `toml:"max_retries"`
	ConnectionTimeout int     `toml:"connection_timeout_ms"`
	KeepAlive         int     `toml:"keep_alive_ms"`
}

type UDP struct {
	RingBufferSize int `toml:"ring_buffer_size"`
	PacketChanSize int `toml:"packet_chan_size"`
}

type Logging struct {
	TimeUnit    logger.TimeUnit `toml:"time_unit"`
	LoggingPath string          `toml:"logging_path"`
}

type Config struct {
	Vehicle   vehicle.Config
	Server    server.Config
	Adj       Adj
	Transport Transport
	TCP       TCP
	UDP       UDP
	Logging   Logging
}
