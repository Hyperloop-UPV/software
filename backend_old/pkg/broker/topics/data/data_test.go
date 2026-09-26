package data_test

import (
	"encoding/json"
	"github.com/HyperloopUPV-H8/h9-backend/internal/update_factory/models"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/tests_functions"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	ws "github.com/gorilla/websocket"
	"github.com/rs/zerolog"
	"os"
	"testing"
	"time"
)

func TestDataTopic_Push(t *testing.T) {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	clientChan := make(chan *websocket.Client)
	u := tests_functions.StartServer(logger, "data")

	// Set up the client
	c, _, clientErr := ws.DefaultDialer.Dial(u.String(), nil)
	if clientErr != nil {
		logger.Fatal().Err(clientErr).Msg("Error dialing")
	}
	defer c.Close()
	defer logger.Info().Str("id", "client").Msg("Client connection closed")

	api := broker.New(logger)
	pool := websocket.NewPool(clientChan, logger)
	client := websocket.NewClient(c)
	clientChan <- client

	dataTopic := data.NewUpdateTopic(1 * time.Millisecond)
	dataTopic.SetAPI(api)
	dataTopic.SetPool(pool)

	// Simulate sending a download request

	request := data.NewPush(&models.Update{
		Id:        1,
		HexValue:  "test",
		Count:     1,
		CycleTime: 1,
		Values: map[string]models.UpdateValue{
			"test": &models.NumericValue{
				Value:   1.0,
				Average: 1.0,
			},
		},
	})
	pushErr := dataTopic.Push(request)
	if pushErr != nil {
		t.Fatal("Error pushing:", pushErr)
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

		payload := data.NewPush(&models.Update{
			Id:        1,
			HexValue:  "test",
			Count:     1,
			CycleTime: 1,
			Values: map[string]models.UpdateValue{
				"test": &models.NumericValue{
					Value:   1.0,
					Average: 1.0,
				},
			},
		})
		payloadBytes, _ := json.Marshal(payload)

		if string(output.Payload) != string(payloadBytes) {
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

func TestDataTopic_ClientMessage(t *testing.T) {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	api := broker.New(logger)

	dataTopic := data.NewUpdateTopic(1 * time.Millisecond)
	dataTopic.SetAPI(api)

	payload := data.NewPush(&models.Update{
		Id:        1,
		HexValue:  "test",
		Count:     1,
		CycleTime: 1,
		Values: map[string]models.UpdateValue{
			"test": &models.NumericValue{
				Value:   1.0,
				Average: 1.0,
			},
		},
	})
	payloadBytes, _ := json.Marshal(payload)
	dataTopic.ClientMessage(websocket.ClientId{0}, &websocket.Message{
		Topic:   data.SubscribeName,
		Payload: payloadBytes,
	})
}
