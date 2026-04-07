package tcp

import (
	"context"
	"math"
	"net"
	"time"
)

// ClientConfig defines all configuration options for TCP client connections
type ClientConfig struct {
	net.Dialer

	Context context.Context

	TryReconnect              bool
	ConnectionBackoffFunction backoffFunction
	MaxConnectionRetries      int
}

// NewClientConfig creates a new client configuration with good defaults
func NewClientConfig(laddr net.Addr) ClientConfig {
	return ClientConfig{
		Dialer: net.Dialer{
			Timeout:   time.Second,
			LocalAddr: laddr,
			KeepAlive: -1, // managed via KeepAliveConfig
			KeepAliveConfig: net.KeepAliveConfig{
				Enable:   true,
				Idle:     time.Second,
				Interval: time.Second,
				Count:    3,
			},
		},

		Context:                   context.TODO(),
		TryReconnect:              true,
		ConnectionBackoffFunction: NewExponentialBackoff(defaultBackoffMin, defaultBackoffExp, defaultBackoffMax),
		MaxConnectionRetries:      -1,
	}
}

type backoffFunction = func(int) time.Duration

const (
	defaultBackoffMin          time.Duration = 100 * time.Millisecond
	defaultBackoffExp          float64       = 1.5
	defaultBackoffMax          time.Duration = 5 * time.Second
	defaultBackoffRetriesClamp int           = 12
)

// NewExponentialBackoff returns an exponential backoff function with the given paramenters.
//
// It follows this formula: delay = (min * (exp ^ n); delay < max ? delay : max
func NewExponentialBackoff(min time.Duration, exp float64, max time.Duration) backoffFunction {
	return func(n int) time.Duration {
		if n > defaultBackoffRetriesClamp {
			n = defaultBackoffRetriesClamp
		}
		curr := time.Duration(float64(min) * math.Trunc(math.Pow(exp, float64(n))))
		if curr >= max {
			return max
		}
		return curr
	}
}

// ServerConfig defines all configuration options for TCP server connections
type ServerConfig struct {
	net.ListenConfig

	Context context.Context
}

func NewServerConfig() ServerConfig {
	return ServerConfig{
		ListenConfig: net.ListenConfig{
			KeepAlive: -1, // managed via KeepAliveConfig
			KeepAliveConfig: net.KeepAliveConfig{
				Enable:   true,
				Idle:     time.Second,
				Interval: time.Second,
				Count:    3,
			},
		},
		Context: context.TODO(),
	}
}
