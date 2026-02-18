package blcu_test

import (
	"encoding/json"
	"fmt"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/blcu"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/tests_functions"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	ws "github.com/gorilla/websocket"
	"github.com/rs/zerolog"
	"log"
	"os"
	"testing"
	"time"
)

var errorFlag bool

type OutputNotMatchingError struct{}

func (e *OutputNotMatchingError) Error() string {
	return "Output does not match"
}

type MockAPI struct{}

func (api MockAPI) UserPush(push abstraction.BrokerPush) error {
	switch push.(type) {
	case blcu.DownloadRequest:
		if push.(blcu.DownloadRequest).Board != "test" {
			errorFlag = true
			return &OutputNotMatchingError{}
		}
		errorFlag = false
		log.Printf("Output matches")
		return nil
	case *blcu.UploadRequestInternal:
		req := push.(*blcu.UploadRequestInternal)
		if req.Board != "test" || string(req.Data) != "test" {
			errorFlag = true
			fmt.Printf("Expected board 'test' and data 'test', got board '%s' and data '%s'\n", req.Board, string(req.Data))
			return &OutputNotMatchingError{}
		}
		errorFlag = false
		log.Printf("Output matches")
		return nil
	}
	return nil
}

func (api MockAPI) UserPull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	return nil, nil
}

func TestBLCUTopic_Download_Push(t *testing.T) {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	clientChan := make(chan *websocket.Client)
	u := tests_functions.StartServer(logger, "download")

	// Mock first client as it always fails
	c, _, err := ws.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Printf("Expected dial error")
	}
	c.Close()

	// Set up the client
	c, _, err = ws.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		logger.Fatal().Err(err).Msg("Error dialing")
	}
	defer c.Close()
	defer logger.Info().Str("id", "client").Msg("Client connection closed")

	api := broker.New(logger)
	pool := websocket.NewPool(clientChan, logger)
	client := websocket.NewClient(c)
	clientChan <- client

	download := blcu.Download{}
	download.SetAPI(api)
	download.SetPool(pool)

	// Simulate sending a download request
	request := blcu.DownloadRequest{Board: "test"}
	err = download.Push(request)
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
		if output.Topic != blcu.DownloadName {
			t.Errorf("Expected topic %s, got %s", blcu.DownloadName, output.Topic)
		}
		if string(output.Payload) != "test" {
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

func TestBLCUTopic_Download_ClientMessage(t *testing.T) {
	download := blcu.Download{}
	download.SetAPI(&MockAPI{})

	download.ClientMessage(websocket.ClientId{0}, &websocket.Message{
		Topic:   blcu.DownloadName,
		Payload: []byte(`{"board":"test"}`),
	})

	if errorFlag {
		t.Fatal("Output does not match")
	}
}

func TestBLCUTopic_Upload_Push(t *testing.T) {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	clientChan := make(chan *websocket.Client)
	u := tests_functions.StartServer(logger, "upload")

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

	upload := blcu.Upload{}
	upload.SetAPI(api)
	upload.SetPool(pool)

	// Simulate sending an upload request
	request := blcu.UploadRequest{Board: "test", File: "dGVzdA=="} // "test" in base64
	err = upload.Push(request)
	if err != nil {
		t.Fatal("Error pushing upload request:", err)
	}

	// Use a timeout for client read
	done := make(chan struct{})
	go func() {
		output, err := client.Read()
		if err != nil {
			logger.Error().Err(err).Msg("Client read failed")
			done <- struct{}{}
			return
		}
		if output.Topic != blcu.UploadName {
			t.Errorf("Expected topic %s, got %s", blcu.UploadName, output.Topic)
		}
		if string(output.Payload) != "test" {
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

func TestBLCUTopic_Upload_ClientMessage(t *testing.T) {
	upload := blcu.Upload{}
	upload.SetAPI(&MockAPI{})

	// Use base64 encoded data as the frontend would send
	payload := blcu.UploadRequest{Board: "test", File: "dGVzdA=="} // "test" in base64
	payloadBytes, _ := json.Marshal(payload)

	upload.ClientMessage(websocket.ClientId{0}, &websocket.Message{
		Topic:   blcu.UploadName,
		Payload: payloadBytes,
	})

	if errorFlag {
		t.Fatal("Output does not match")
	}
}
