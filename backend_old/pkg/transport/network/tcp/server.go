package tcp

import (
	"net"

	"github.com/rs/zerolog"
)

type connectionCallback = func(conn net.Conn) error

type Server struct {
	config  ServerConfig
	address string

	whitelist    map[string]struct{}
	onConnection connectionCallback
	closeChan    chan struct{}

	logger zerolog.Logger
}

// NewServer inits a new ServerConfig with good defaults and the provided values
func NewServer(address string, config ServerConfig, baseLogger zerolog.Logger) Server {
	logger := baseLogger.With().Str("localAddres", address).Logger()
	return Server{
		config:  config,
		address: address,

		whitelist: make(map[string]struct{}),
		onConnection: func(conn net.Conn) error {
			defer conn.Close()
			logger.Warn().Str("remoteAddress", conn.RemoteAddr().String()).Msg("connection callback not set yet")
			return nil
		},
		closeChan: make(chan struct{}),

		logger: logger,
	}
}

// Listen binds the server to its addres and starts listening for incoming connections.
//
// Listen will block until an error is encountered.
func (server *Server) Listen() error {
	listener, err := server.config.ListenConfig.Listen(server.config.Context, "tcp", server.address)
	if err != nil {
		server.logger.Error().Stack().Err(err).Msg("listening")
		return err
	}
	defer listener.Close()
	server.logger.Info().Msg("listening")
	defer server.logger.Info().Msg("stopped listening")

	errChan := make(chan error, 1)
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				server.logger.Error().Stack().Err(err).Msg("accept")
				errChan <- err
				break
			}
			connectionLogger := server.logger.With().Str("remoteAddress", conn.RemoteAddr().String()).Logger()

			if !server.IsWhitelisted(conn.RemoteAddr().(*net.TCPAddr).IP.String()) {
				connectionLogger.Warn().Msg("unauthorized connection")
				conn.Close()
				continue
			}
			connectionLogger.Debug().Msg("new connection")

			go func() {
				err = server.onConnection(conn)
				if err != nil {
					connectionLogger.Error().Stack().Err(err).Msg("connection")
				}
			}()
		}
	}()

	select {
	case <-server.closeChan:
		return nil
	case err := <-errChan:
		return err
	}
}

// IsWhitelisted checks if the address is in the server whitelist
func (server *Server) IsWhitelisted(addr string) bool {
	_, ok := server.whitelist[addr]
	return ok
}

// AddToWhitelist adds a new address to the server whitelist
func (server *Server) AddToWhitelist(addr string) {
	server.whitelist[addr] = struct{}{}
	server.logger.Trace().Str("address", addr).Msg("added to whitelist")
}

// RemoveafromWhitelist removes an address from the server whitelist
func (server *Server) RemoveFromWhitelist(addr string) {
	delete(server.whitelist, addr)
	server.logger.Trace().Str("address", addr).Msg("removed from whitelist")
}

// OnConnection sets the callback that will be used when a new connection is created
func (server *Server) OnConnection(callback connectionCallback) {
	server.onConnection = callback
	server.logger.Trace().Msg("changed connection logic")
}

// Close closes the server and stops listening for connections
func (server *Server) Close() {
	server.logger.Debug().Msg("closing")
	server.closeChan <- struct{}{}
	server.logger.Debug().Msg("closed")
}
