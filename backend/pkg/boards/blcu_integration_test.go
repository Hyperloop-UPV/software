package boards_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/boards"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker"
	blcu_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/blcu"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/vehicle"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	"github.com/rs/zerolog"
)

// MockTransport implements abstraction.Transport for testing
type MockTransport struct {
	sentMessages []abstraction.TransportMessage
}

func (m *MockTransport) SendMessage(msg abstraction.TransportMessage) error {
	m.sentMessages = append(m.sentMessages, msg)
	return nil
}

func (m *MockTransport) HandleClient(config interface{}, target string) error {
	return nil
}

func (m *MockTransport) HandleServer(config interface{}, addr string) error {
	return nil
}

func (m *MockTransport) HandleSniffer(sniffer interface{}) error {
	return nil
}

func (m *MockTransport) SetAPI(api abstraction.TransportAPI) {}

func (m *MockTransport) SetIdTarget(id abstraction.PacketId, target abstraction.TransportTarget) {}

func (m *MockTransport) SetTargetIp(ip string, target abstraction.TransportTarget) {}

func (m *MockTransport) SetpropagateFault(propagate bool) {}

func (m *MockTransport) WithDecoder(decoder interface{}) abstraction.Transport {
	return m
}

func (m *MockTransport) WithEncoder(encoder interface{}) abstraction.Transport {
	return m
}

// MockLogger implements abstraction.Logger for testing
type MockLogger struct{}

func (m *MockLogger) Start() error {
	return nil
}

func (m *MockLogger) Stop() error {
	return nil
}

func (m *MockLogger) PushRecord(record abstraction.LoggerRecord) error {
	return nil
}

func (m *MockLogger) PullRecord(request abstraction.LoggerRequest) (abstraction.LoggerRecord, error) {
	return nil, nil
}

// TestBLCUDownloadOrder tests the BLCU download order flow
func TestBLCUDownloadOrder(t *testing.T) {
	// Setup
	logger := zerolog.New(nil).Level(zerolog.Disabled)
	
	// Create vehicle
	v := vehicle.New(logger)
	
	// Create and setup broker
	b := broker.New(logger)
	connections := make(chan *websocket.Client)
	pool := websocket.NewPool(connections, logger)
	b.SetPool(pool)
	
	// Register BLCU topics
	blcu_topic.RegisterTopics(b, pool)
	
	// Set broker and transport
	v.SetBroker(b)
	mockTransport := &MockTransport{}
	v.SetTransport(mockTransport)
	mockLogger := &MockLogger{}
	v.SetLogger(mockLogger)
	
	// Create BLCU board
	blcuBoard := boards.New("192.168.0.10") // Example IP
	
	// This is the missing step - register the BLCU board with the vehicle
	v.AddBoard(blcuBoard)
	
	// Note: In a real scenario, we would capture responses through the broker
	
	// Test download request
	t.Run("Download Request", func(t *testing.T) {
		downloadRequest := &blcu_topic.DownloadRequest{
			Board: "VCU",
		}
		
		// Send download request through UserPush
		err := v.UserPush(downloadRequest)
		if err != nil {
			t.Fatalf("UserPush failed: %v", err)
		}
		
		// Simulate ACK from board
		blcuBoard.Notify(boards.AckNotification{
			ID: boards.AckId,
		})
		
		// Check if the download order was sent to the board
		if len(mockTransport.sentMessages) == 0 {
			t.Fatal("No message sent to transport")
		}
		
		// Verify the packet sent contains the correct order ID
		// In a real test, we would decode the packet and verify its contents
	})
}

// TestBLCUUploadOrder tests the BLCU upload order flow
func TestBLCUUploadOrder(t *testing.T) {
	// Setup
	logger := zerolog.New(nil).Level(zerolog.Disabled)
	
	// Create vehicle
	v := vehicle.New(logger)
	
	// Create and setup broker
	b := broker.New(logger)
	connections := make(chan *websocket.Client)
	pool := websocket.NewPool(connections, logger)
	b.SetPool(pool)
	
	// Register BLCU topics
	blcu_topic.RegisterTopics(b, pool)
	
	// Set broker and transport
	v.SetBroker(b)
	mockTransport := &MockTransport{}
	v.SetTransport(mockTransport)
	mockLogger := &MockLogger{}
	v.SetLogger(mockLogger)
	
	// Create BLCU board
	blcuBoard := boards.New("192.168.0.10") // Example IP
	
	// Register the BLCU board with the vehicle
	v.AddBoard(blcuBoard)
	
	// Test upload request
	t.Run("Upload Request", func(t *testing.T) {
		// Using the internal request type that has Data field
		uploadRequest := &blcu_topic.UploadRequestInternal{
			Board: "VCU",
			Data:  []byte("test firmware data"),
		}
		
		// Send upload request through UserPush
		err := v.UserPush(uploadRequest)
		if err != nil {
			t.Fatalf("UserPush failed: %v", err)
		}
		
		// Simulate ACK from board
		blcuBoard.Notify(boards.AckNotification{
			ID: boards.AckId,
		})
		
		// Check if the upload order was sent to the board
		if len(mockTransport.sentMessages) == 0 {
			t.Fatal("No message sent to transport")
		}
	})
}

// TestBLCUWebSocketFlow tests the complete WebSocket flow for BLCU orders
func TestBLCUWebSocketFlow(t *testing.T) {
	// Setup
	logger := zerolog.New(nil).Level(zerolog.Disabled)
	
	// Create vehicle
	v := vehicle.New(logger)
	
	// Create and setup broker
	b := broker.New(logger)
	connections := make(chan *websocket.Client)
	pool := websocket.NewPool(connections, logger)
	b.SetPool(pool)
	
	// Register BLCU topics
	blcu_topic.RegisterTopics(b, pool)
	
	// Set broker
	v.SetBroker(b)
	mockTransport := &MockTransport{}
	v.SetTransport(mockTransport)
	mockLogger := &MockLogger{}
	v.SetLogger(mockLogger)
	
	// Create BLCU board
	blcuBoard := boards.New("192.168.0.10")
	v.AddBoard(blcuBoard)
	
	// Simulate WebSocket client message
	t.Run("WebSocket Download Message", func(t *testing.T) {
		// Get download topic handler from registered topics
		downloadHandler := &blcu_topic.Download{}
		downloadHandler.SetAPI(b)
		downloadHandler.SetPool(pool)
		
		// Create WebSocket message
		downloadReq := blcu_topic.DownloadRequest{
			Board: "VCU",
		}
		payload, _ := json.Marshal(downloadReq)
		
		wsMessage := &websocket.Message{
			Topic:   blcu_topic.DownloadName,
			Payload: payload,
		}
		
		// Simulate client message
		// Create a valid UUID for ClientId
		clientUUID := [16]byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
		clientId := websocket.ClientId(clientUUID)
		downloadHandler.ClientMessage(clientId, wsMessage)
		
		// Give some time for async operations
		time.Sleep(100 * time.Millisecond)
		
		// Verify order was sent
		if len(mockTransport.sentMessages) == 0 {
			t.Error("No message sent to transport after WebSocket message")
		}
	})
}

// TestBLCURegistrationIssue demonstrates the issue when BLCU is not registered
func TestBLCURegistrationIssue(t *testing.T) {
	// Setup WITHOUT registering BLCU board
	logger := zerolog.New(nil).Level(zerolog.Disabled)
	
	v := vehicle.New(logger)
	b := broker.New(logger)
	connections := make(chan *websocket.Client)
	pool := websocket.NewPool(connections, logger)
	b.SetPool(pool)
	blcu_topic.RegisterTopics(b, pool)
	v.SetBroker(b)
	
	// Try to send download request without BLCU board registered
	t.Run("Download Without Registration", func(t *testing.T) {
		defer func() {
			if r := recover(); r == nil {
				// If no panic, check if the request was handled
				// In the current implementation, this will fail silently
				t.Log("Request handled without BLCU registration - this is the bug!")
			}
		}()
		
		downloadRequest := &blcu_topic.DownloadRequest{
			Board: "VCU",
		}
		
		// This will fail because boards[boards.BlcuId] is nil
		err := v.UserPush(downloadRequest)
		if err == nil {
			t.Log("UserPush succeeded but BLCU board notification will fail")
		}
	})
}