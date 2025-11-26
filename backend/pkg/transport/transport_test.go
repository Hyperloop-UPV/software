package transport

import (
	"context"
	"encoding/binary"
	"fmt"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/tcp"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/presentation"
	"github.com/rs/zerolog"
)

// TestTransportAPI implements abstraction.TransportAPI for testing
type TestTransportAPI struct {
	mu                sync.RWMutex
	connectionUpdates []ConnectionUpdate
	notifications     []abstraction.TransportNotification
}

type ConnectionUpdate struct {
	Target      abstraction.TransportTarget
	IsConnected bool
	Timestamp   time.Time
}

func NewTestTransportAPI() *TestTransportAPI {
	return &TestTransportAPI{
		connectionUpdates: make([]ConnectionUpdate, 0),
		notifications:     make([]abstraction.TransportNotification, 0),
	}
}

func (api *TestTransportAPI) ConnectionUpdate(target abstraction.TransportTarget, isConnected bool) {
	api.mu.Lock()
	defer api.mu.Unlock()
	api.connectionUpdates = append(api.connectionUpdates, ConnectionUpdate{
		Target:      target,
		IsConnected: isConnected,
		Timestamp:   time.Now(),
	})
}

func (api *TestTransportAPI) Notification(notification abstraction.TransportNotification) {
	api.mu.Lock()
	defer api.mu.Unlock()
	api.notifications = append(api.notifications, notification)
}

func (api *TestTransportAPI) GetConnectionUpdates() []ConnectionUpdate {
	api.mu.RLock()
	defer api.mu.RUnlock()
	updates := make([]ConnectionUpdate, len(api.connectionUpdates))
	copy(updates, api.connectionUpdates)
	return updates
}

func (api *TestTransportAPI) GetNotifications() []abstraction.TransportNotification {
	api.mu.RLock()
	defer api.mu.RUnlock()
	notifications := make([]abstraction.TransportNotification, len(api.notifications))
	copy(notifications, api.notifications)
	return notifications
}

func (api *TestTransportAPI) Reset() {
	api.mu.Lock()
	defer api.mu.Unlock()
	api.connectionUpdates = api.connectionUpdates[:0]
	api.notifications = api.notifications[:0]
}

// MockBoardServer simulates a vehicle board
type MockBoardServer struct {
	address     string
	listener    net.Listener
	mu          sync.RWMutex
	running     bool
	connections []net.Conn
	packetsRecv []abstraction.Packet
	encoder     *presentation.Encoder
	decoder     *presentation.Decoder
}

func NewMockBoardServer(address string) *MockBoardServer {
	logger := zerolog.Nop()

	enc := presentation.NewEncoder(binary.BigEndian, logger)
    dec := presentation.NewDecoder(binary.BigEndian, logger)
    wireTestPacketCodec(enc, dec, abstraction.PacketId(100))

	return &MockBoardServer{
		address:     address,
		connections: make([]net.Conn, 0),
		packetsRecv: make([]abstraction.Packet, 0),
		encoder:     enc,
		decoder:     dec,
	}
}

func (s *MockBoardServer) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if s.running {
		return fmt.Errorf("server already running")
	}
	
	listener, err := net.Listen("tcp", s.address)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", s.address, err)
	}
	
	s.listener = listener
	s.running = true
	
	go s.acceptLoop()
	
	return nil
}

func (s *MockBoardServer) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if !s.running {
		return nil
	}
	
	s.running = false
	
	// Close all connections
	for _, conn := range s.connections {
		conn.Close()
	}
	s.connections = s.connections[:0]
	
	// Close listener
	if s.listener != nil {
		err := s.listener.Close()
		s.listener = nil
		return err
	}
	
	return nil
}

func (s *MockBoardServer) acceptLoop() {
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			s.mu.RLock()
			running := s.running
			s.mu.RUnlock()
			if !running {
				return
			}
			continue
		}
		
		s.mu.Lock()
		s.connections = append(s.connections, conn)
		s.mu.Unlock()
		
		go s.handleConnection(conn)
	}
}

func (s *MockBoardServer) handleConnection(conn net.Conn) {
	defer func() {
		conn.Close()
		s.mu.Lock()
		// Remove connection from list
		for i, c := range s.connections {
			if c == conn {
				s.connections = append(s.connections[:i], s.connections[i+1:]...)
				break
			}
		}
		s.mu.Unlock()
	}()
	
	for {
		s.mu.RLock()
		running := s.running
		s.mu.RUnlock()
		
		if !running {
			return
		}
		
		// Set read timeout to avoid blocking forever
		conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
		
		packet, err := s.decoder.DecodeNext(conn)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			return
		}
		
		s.mu.Lock()
		s.packetsRecv = append(s.packetsRecv, packet)
		s.mu.Unlock()
	}
}

func (s *MockBoardServer) GetReceivedPackets() []abstraction.Packet {
	s.mu.RLock()
	defer s.mu.RUnlock()
	packets := make([]abstraction.Packet, len(s.packetsRecv))
	copy(packets, s.packetsRecv)
	return packets
}

func (s *MockBoardServer) GetConnectionCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.connections)
}

// Test utilities
func createTestTransport(t *testing.T) (*Transport, *TestTransportAPI) {
	// if NewTestWriter(t) is used: background goroutines may log after the test ends and cause a panic
	//logger := zerolog.New(zerolog.NewTestWriter(t)).With().Timestamp().Logger()
	logger := zerolog.New(zerolog.Nop()).With().Timestamp().Logger()

	enc := presentation.NewEncoder(binary.BigEndian, logger)
    dec := presentation.NewDecoder(binary.BigEndian, logger)
    wireTestPacketCodec(enc, dec, abstraction.PacketId(100))


	transport := NewTransport(logger).
		WithEncoder(enc).
		WithDecoder(dec)
	
	api := NewTestTransportAPI()
	transport.SetAPI(api)
	
	return transport, api
}

func getAvailablePort(t testing.TB) string {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Failed to get available port: %v", err)
	}
	defer listener.Close()
	return listener.Addr().String()
}

// waitForCondition waits for a condition to be true within a timeout
func waitForCondition(condition func() bool, timeout time.Duration, message string) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if condition() {
			return nil
		}
		time.Sleep(50 * time.Millisecond)
	}
	return fmt.Errorf("timeout waiting for condition: %s", message)
}

// test wiring: register a trivial codec for a data packet id.
func wireTestPacketCodec(enc *presentation.Encoder, dec *presentation.Decoder, id abstraction.PacketId) {
    dataEnc := data.NewEncoder(binary.BigEndian)
    dataDec := data.NewDecoder(binary.BigEndian)

    // Empty descriptor = no payload values, just the id header.
    var desc data.Descriptor
    dataEnc.SetDescriptor(id, desc)
    dataDec.SetDescriptor(id, desc)

    enc.SetPacketEncoder(id, dataEnc)
    dec.SetPacketDecoder(id, dataDec)
}

// Unit Tests
func TestTransport_Creation(t *testing.T) {
	logger := zerolog.Nop()
	transport := NewTransport(logger)
	
	if transport == nil {
		t.Fatal("Transport should not be nil")
	}
	if transport.connectionsMx == nil {
		t.Fatal("Transport connectionsMx should not be nil")
	}
	if transport.connections == nil {
		t.Fatal("Transport connections should not be nil")
	}
	if transport.ipToTarget == nil {
		t.Fatal("Transport ipToTarget should not be nil")
	}
	if transport.idToTarget == nil {
		t.Fatal("Transport idToTarget should not be nil")
	}
}

func TestTransport_SetIdTarget(t *testing.T) {
	transport, _ := createTestTransport(t)
	
	transport.SetIdTarget(100, "TEST_BOARD")
	transport.SetIdTarget(200, "ANOTHER_BOARD")
	
	// Access the internal map to verify
	if target := transport.idToTarget[100]; target != abstraction.TransportTarget("TEST_BOARD") {
		t.Errorf("Expected TEST_BOARD, got %s", target)
	}
	if target := transport.idToTarget[200]; target != abstraction.TransportTarget("ANOTHER_BOARD") {
		t.Errorf("Expected ANOTHER_BOARD, got %s", target)
	}
}

func TestTransport_SetTargetIp(t *testing.T) {
	transport, _ := createTestTransport(t)
	
	transport.SetTargetIp("192.168.1.100", "TEST_BOARD")
	transport.SetTargetIp("192.168.1.101", "ANOTHER_BOARD")
	
	// Access the internal map to verify
	if target := transport.ipToTarget["192.168.1.100"]; target != abstraction.TransportTarget("TEST_BOARD") {
		t.Errorf("Expected TEST_BOARD, got %s", target)
	}
	if target := transport.ipToTarget["192.168.1.101"]; target != abstraction.TransportTarget("ANOTHER_BOARD") {
		t.Errorf("Expected ANOTHER_BOARD, got %s", target)
	}
}

func TestTransport_InvalidInputs(t *testing.T) {
	transport, _ := createTestTransport(t)

	// Test invalid ID input
	err := transport.SetIdTarget(0, "")
	if err == nil {
		t.Errorf("Expected error for invalid ID input, got nil")
	}

	// Test invalid IP input
	err = transport.SetTargetIp("", "")
	if err == nil {
		t.Errorf("Expected error for invalid IP input, got nil")
	}
}

func TestTransport_RemoveTargets(t *testing.T) {
	transport, _ := createTestTransport(t)

	// Add entries
	transport.SetIdTarget(100, "TEST_BOARD")
	transport.SetTargetIp("192.168.1.100", "TEST_BOARD")

	// Remove entries
	delete(transport.idToTarget, 100)
	delete(transport.ipToTarget, "192.168.1.100")

	// Verify removal
	if _, exists := transport.idToTarget[100]; exists {
		t.Errorf("Expected ID 100 to be removed, but it still exists")
	}
	if _, exists := transport.ipToTarget["192.168.1.100"]; exists {
		t.Errorf("Expected IP 192.168.1.100 to be removed, but it still exists")
	}
}

// Integration Tests
func TestTransport_ClientServerConnection(t *testing.T) {
	transport, api := createTestTransport(t)
	
	// Setup board configuration
	boardIP := "127.0.0.1"
	boardPort := getAvailablePort(t)
	target := abstraction.TransportTarget("TEST_BOARD")
	
	transport.SetTargetIp(boardIP, target)
	transport.SetIdTarget(100, target)
	
	// Create and start mock board server
	mockBoard := NewMockBoardServer(boardPort)
	err := mockBoard.Start()
	if err != nil {
		t.Fatalf("Failed to start mock board: %v", err)
	}
	defer mockBoard.Stop()
	
	// Configure client
	clientAddr, err := net.ResolveTCPAddr("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Failed to resolve client address: %v", err)
	}
	
	clientConfig := tcp.NewClientConfig(clientAddr)
	clientConfig.TryReconnect = false // Don't retry for this test
	
	// Start client connection in goroutine
	clientDone := make(chan error, 1)
	go func() {
		err := transport.HandleClient(clientConfig, boardPort)
		clientDone <- err
	}()
	
	// Ensure cleanup
	defer func() {
		mockBoard.Stop()
		// Wait for client to finish
		select {
		case <-clientDone:
		case <-time.After(1 * time.Second):
			// Client should exit when board stops
		}
	}()
	
	// Wait for connection
	err = waitForCondition(func() bool {
		return mockBoard.GetConnectionCount() > 0
	}, 2*time.Second, "Board should receive connection")
	if err != nil {
		t.Fatal(err)
	}
	
	// Verify connection update was sent
	err = waitForCondition(func() bool {
		updates := api.GetConnectionUpdates()
		return len(updates) > 0 && updates[len(updates)-1].IsConnected
	}, 2*time.Second, "Should receive connection update")
	if err != nil {
		t.Fatal(err)
	}
	
	// Stop the board to trigger disconnection
	mockBoard.Stop()
	
	// Wait for client to detect disconnection
	select {
	case err := <-clientDone:
		// Client should exit due to connection loss
		if err == nil {
			t.Error("Expected error from client due to disconnection")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Client should have detected disconnection")
	}
	
	// Verify disconnection update
	err = waitForCondition(func() bool {
		updates := api.GetConnectionUpdates()
		return len(updates) >= 2 && !updates[len(updates)-1].IsConnected
	}, 2*time.Second, "Should receive disconnection update")
	if err != nil {
		t.Fatal(err)
	}
}

func TestTransport_PacketSending(t *testing.T) {
	transport, api := createTestTransport(t)
	
	// Setup
	boardIP := "127.0.0.1"
	boardPort := getAvailablePort(t)
	target := abstraction.TransportTarget("TEST_BOARD")
	packetID := abstraction.PacketId(100)
	
	transport.SetTargetIp(boardIP, target)
	transport.SetIdTarget(packetID, target)
	
	// Create mock board
	mockBoard := NewMockBoardServer(boardPort)
	err := mockBoard.Start()
	if err != nil {
		t.Fatalf("Failed to start mock board: %v", err)
	}
	defer mockBoard.Stop()
	
	// Start client
	clientAddr, _ := net.ResolveTCPAddr("tcp", "127.0.0.1:0")
	clientConfig := tcp.NewClientConfig(clientAddr)
	clientConfig.TryReconnect = false
	
	clientDone := make(chan struct{})
	go func() {
		defer close(clientDone)
		transport.HandleClient(clientConfig, boardPort)
	}()
	
	// Ensure cleanup
	defer func() {
		mockBoard.Stop()
		select {
		case <-clientDone:
		case <-time.After(1 * time.Second):
		}
	}()
	
	// Wait for connection
	err = waitForCondition(func() bool {
    	updates := api.GetConnectionUpdates()
    	return len(updates) > 0 && updates[len(updates)-1].Target == target && updates[len(updates)-1].IsConnected
	}, 2*time.Second, "Should establish connection")
	if err != nil {
		t.Fatal(err)
	}
	
	// Create and send packet
	testPacket := data.NewPacket(packetID)
	testPacket.SetTimestamp(time.Now())
	
	err = transport.SendMessage(NewPacketMessage(testPacket))
	if err != nil {
		t.Fatalf("Failed to send packet: %v", err)
	}
	
	// Verify packet was received by board
	err = waitForCondition(func() bool {
		packets := mockBoard.GetReceivedPackets()
		return len(packets) > 0 && packets[0].Id() == packetID
	}, 2*time.Second, "Board should receive the packet")
	if err != nil {
		t.Fatal(err)
	}
	
	// Verify no error notifications
	notifications := api.GetNotifications()
	for _, notification := range notifications {
		if errNotif, ok := notification.(ErrorNotification); ok {
			t.Errorf("Unexpected error notification: %v", errNotif.Err)
		}
	}
}

func TestTransport_UnknownTarget(t *testing.T) {
	transport, api := createTestTransport(t)
	
	// Try to send packet to unknown target
	unknownPacket := data.NewPacket(999) // Unknown packet ID
	unknownPacket.SetTimestamp(time.Now())
	
	err := transport.SendMessage(NewPacketMessage(unknownPacket))
	if err == nil {
		t.Fatal("Expected error when sending to unknown target")
	}
	
	// Should be ErrUnrecognizedId
	var unrecognizedErr ErrUnrecognizedId
	if !ErrorAs(err, &unrecognizedErr) {
		t.Errorf("Expected ErrUnrecognizedId, got %T: %v", err, err)
	} else if unrecognizedErr.Id != abstraction.PacketId(999) {
		t.Errorf("Expected packet ID 999, got %d", unrecognizedErr.Id)
	}
	
	// Verify error notification
	err = waitForCondition(func() bool {
		notifications := api.GetNotifications()
		if len(notifications) == 0 {
			return false
		}
		_, isErrorNotif := notifications[len(notifications)-1].(ErrorNotification)
		return isErrorNotif
	}, 2*time.Second, "Should receive error notification")
	if err != nil {
		t.Fatal(err)
	}
}

func TestTransport_ReconnectionBehavior(t *testing.T) {
	transport, api := createTestTransport(t)
	
	// Setup
	boardIP := "127.0.0.1"
	boardPort := getAvailablePort(t)
	target := abstraction.TransportTarget("RECONNECT_BOARD")
	
	transport.SetTargetIp(boardIP, target)
	transport.SetIdTarget(100, target)
	
	// Create mock board
	mockBoard := NewMockBoardServer(boardPort)
	err := mockBoard.Start()
	if err != nil {
		t.Fatalf("Failed to start mock board: %v", err)
	}
	
	// Configure client with fast reconnection for testing
	clientAddr, _ := net.ResolveTCPAddr("tcp", "127.0.0.1:0")
	clientConfig := tcp.NewClientConfig(clientAddr)
	clientConfig.TryReconnect = true
	clientConfig.MaxConnectionRetries = 0 // Infinite retries
	clientConfig.ConnectionBackoffFunction = tcp.NewExponentialBackoff(
		10*time.Millisecond,  // Fast for testing
		1.5,
		100*time.Millisecond,
	)
	
	// Start client with proper cleanup
	ctx, cancel := context.WithCancel(context.Background())
	clientConfig.Context = ctx
	
	clientDone := make(chan struct{})
	go func() {
		defer close(clientDone)
		transport.HandleClient(clientConfig, boardPort)
	}()
	
	// Ensure cleanup happens
	defer func() {
		cancel()
		mockBoard.Stop()
		// Wait for client goroutine to finish
		select {
		case <-clientDone:
		case <-time.After(1 * time.Second):
			t.Log("Warning: client goroutine did not finish within timeout")
		}
	}()
	
	// Wait for initial connection
	err = waitForCondition(func() bool {
		return mockBoard.GetConnectionCount() > 0
	}, 3*time.Second, "Should establish initial connection")
	if err != nil {
		t.Fatal(err)
	}
	
	// Verify connection update
	err = waitForCondition(func() bool {
		updates := api.GetConnectionUpdates()
		return len(updates) > 0 && updates[len(updates)-1].IsConnected
	}, 2*time.Second, "Should receive connection update")
	if err != nil {
		t.Fatal(err)
	}
	
	// Simulate board restart
	mockBoard.Stop()
	
	// Wait for disconnection detection
	err = waitForCondition(func() bool {
		updates := api.GetConnectionUpdates()
		for i := len(updates) - 1; i >= 0; i-- {
			if !updates[i].IsConnected && updates[i].Target == target {
				return true
			}
		}
		return false
	}, 3*time.Second, "Should detect disconnection")
	if err != nil {
		t.Fatal(err)
	}
	
	// Restart board
	mockBoard = NewMockBoardServer(boardPort)
	err = mockBoard.Start()
	if err != nil {
		t.Fatalf("Failed to restart mock board: %v", err)
	}
	
	// Wait for reconnection
	err = waitForCondition(func() bool {
		return mockBoard.GetConnectionCount() > 0
	}, 5*time.Second, "Should reconnect to restarted board")
	if err != nil {
		t.Fatal(err)
	}
	
	// Verify reconnection update
	err = waitForCondition(func() bool {
		updates := api.GetConnectionUpdates()
		if len(updates) < 3 { // Initial connect, disconnect, reconnect
			return false
		}
		// Look for a connection update after the disconnection
		for i := len(updates) - 1; i >= 0; i-- {
			if updates[i].IsConnected && updates[i].Target == target {
				// Make sure this is after a disconnection
				for j := i - 1; j >= 0; j-- {
					if !updates[j].IsConnected && updates[j].Target == target {
						return true
					}
				}
			}
		}
		return false
	}, 5*time.Second, "Should receive reconnection update")
	if err != nil {
		t.Fatal(err)
	}
}

// Helper function to mimic errors.As behavior
func ErrorAs(err error, target interface{}) bool {
	switch target := target.(type) {
	case *ErrUnrecognizedId:
		if e, ok := err.(ErrUnrecognizedId); ok {
			*target = e
			return true
		}
	case *ErrConnClosed:
		if e, ok := err.(ErrConnClosed); ok {
			*target = e
			return true
		}
	}
	return false
}