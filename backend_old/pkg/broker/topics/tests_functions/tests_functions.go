package tests_functions

import (
	"fmt"
	ws "github.com/gorilla/websocket"
	"github.com/rs/zerolog"
	"net/http"
	"net/url"
)

func StartServer(logger zerolog.Logger, name string) url.URL {
	u := url.URL{Scheme: "ws", Host: "localhost:8080", Path: fmt.Sprintf("/%s", name)}

	// Start HTTP server with WebSocket upgrade and echo back
	http.HandleFunc(fmt.Sprintf("/%s", name), func(writer http.ResponseWriter, request *http.Request) {
		upgrader := ws.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		}
		conn, upgradeErr := upgrader.Upgrade(writer, request, nil)
		if upgradeErr != nil {
			logger.Error().Err(upgradeErr).Msg("Failed to upgrade")
			return
		}
		defer conn.Close()
		defer logger.Info().Str("id", "server").Msg("Connection closed")

		// Handle and echo messages continuously
		go func() {
			for {
				_, msg, readMsgRead := conn.ReadMessage()
				if readMsgRead != nil {
					logger.Error().Err(readMsgRead).Msg("Read error")
					return
				}
				writeMsgErr := conn.WriteMessage(ws.TextMessage, msg)
				if writeMsgErr != nil {
					logger.Error().Err(writeMsgErr).Msg("Write error")
					return
				}
			}
		}()
	})

	go http.ListenAndServe(":8080", nil)

	return u
}
