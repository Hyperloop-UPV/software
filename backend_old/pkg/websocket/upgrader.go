package websocket

import (
	"net/http"

	ws "github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

type Upgrader struct {
	ws.Upgrader
	connections chan<- *Client

	logger zerolog.Logger
}

func NewUpgrader(connections chan<- *Client, baseLogger zerolog.Logger) *Upgrader {
	return &Upgrader{
		Upgrader: ws.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin:     func(_ *http.Request) bool { return true },
		},
		connections: connections,

		logger: baseLogger,
	}
}

func (upgrader *Upgrader) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()

	conn, err := upgrader.Upgrade(writer, request, nil)
	if err != nil {
		upgrader.logger.Error().Stack().Err(err).Msg("upgrade")
		return
	}

	upgrader.logger.Trace().Str("remoteAddress", request.RemoteAddr).Msg("upgraded new connection")
	upgrader.connections <- NewClient(conn)
}
