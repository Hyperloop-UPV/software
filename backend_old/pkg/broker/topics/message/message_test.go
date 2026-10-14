package message_test

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker"
	data "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/message"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/tests_functions"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/protection"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	ws "github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

func TestMessageTopic_Push(t *testing.T) {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	clientChan := make(chan *websocket.Client)
	u := tests_functions.StartServer(logger, "message")

	// Set up the client
	c, _, err := ws.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		logger.Fatal().Err(err).Msg("Error dialing")
	}
	defer c.Close()
	defer logger.Info().Str("id", "client").Msg("Client connection closed")

	api := broker.New(logger)
	pool := websocket.NewPool(clientChan, logger)
	client := websocket.NewClient(c)
	clientChan <- client

	messageTopic := data.NewUpdateTopic()
	messageTopic.SetAPI(api)
	messageTopic.SetPool(pool)

	// Simulate sending a download request
	request := data.Push("test", "test_board")
	err = messageTopic.Push(request)
	if err != nil {
		t.Fatal("Error pushing download request:", err)
	}

	// Use a timeout for client read
	done := make(chan struct{})
	go func() {
		output, readErr := client.Read()
		if readErr != nil {
			logger.Error().Err(readErr).Msg("Client read failed")
			done <- struct{}{}
			return
		}
		if output.Topic != data.UpdateName {
			t.Errorf("Expected topic %s, got %s", data.UpdateName, output.Topic)
		}

		comparison := map[abstraction.BoardId]string{
			0: "test",
		}
		comparisonBytes, _ := json.Marshal(comparison)
		if string(output.Payload) != string(comparisonBytes) {
			t.Error("Expected payload 'test', got", string(output.Payload))
		}
		done <- struct{}{}
	}()

	select {
	case <-done:
		logger.Info().Msg("Test completed successfully")
	case <-time.After(3 * time.Second):
		t.Error("Test timed out")
	}
}

func TestMessageTopic_ClientMessage(t *testing.T) {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	api := broker.New(logger)

	messageTopic := data.NewUpdateTopic()
	messageTopic.SetAPI(api)

	packet := protection.NewPacket(0, protection.OkSeverity)
	payload := data.Push(packet, "test_board")
	payloadBytes, _ := json.Marshal(payload)
	messageTopic.ClientMessage(websocket.ClientId{0}, &websocket.Message{
		Topic:   data.SubscribeName,
		Payload: payloadBytes,
	})
}
