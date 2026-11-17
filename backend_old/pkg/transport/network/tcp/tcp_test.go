package tcp_test

import (
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/tcp"
	"github.com/rs/zerolog"
	"net"
	"os"
	"testing"
	"time"
)

type Socket struct {
	SrcIP   string
	SrcPort uint16
	DstIP   string
	DstPort uint16
}

// Payload defines a piece of information coming from the network with its metadata
type Payload struct {
	Timestamp time.Time
	Socket    Socket
	Data      []byte
}

type Addr struct {
	Net  string
	Addr string
}

func (a Addr) Network() string {
	return a.Net
}

func (a Addr) String() string {
	return a.Addr
}

func TestTCP(t *testing.T) {
	logger := zerolog.New(os.Stdout)

	// Server setup
	serverAddrSol, _ := net.ResolveTCPAddr("tcp", "127.0.0.1:8000")
	serverAddr := serverAddrSol.String()

	server := tcp.NewServer(serverAddr, tcp.NewServerConfig(), logger)
	server.AddToWhitelist("127.0.0.1")

	server.OnConnection(func(conn net.Conn) error {
		defer conn.Close()

		for {
			// Read and echo back the Payload
			buffer := make([]byte, len([]byte("hello")))
			_, err := conn.Read(buffer)
			if err != nil {
				println("Failed to read from client: %v", err)
			}
			_, err = conn.Write(buffer)
			if err != nil {
				println("Failed to write to client: %v", err)
			}
		}

	})

	go func() {
		defer server.Close()
		err := server.Listen()
		if err != nil {
			println("Server failed to listen: %v", err)
		}
	}()

	// Client setup
	addr, _ := net.ResolveTCPAddr("tcp", "127.0.0.1:3000")
	client := tcp.NewClient(serverAddr, tcp.NewClientConfig(net.Addr(addr)), logger)

	time.Sleep(10 * time.Millisecond)

	conn, err := client.Dial()
	if err != nil {
		t.Fatalf("Client failed to dial: %v", err)
	}
	defer conn.Close()

	// Create and send Payload
	originalPayload := Payload{
		Timestamp: time.Now(),
		Socket: Socket{
			SrcIP:   "127.0.0.1",
			SrcPort: 3000,
			DstIP:   "127.0.0.1",
			DstPort: 8080,
		},
		Data: []byte("hello"),
	}
	_, err = conn.Write(originalPayload.Data)
	if err != nil {
		t.Fatalf("Failed to write Payload to server: %v", err)
	}

	// Read file
	buffer := make([]byte, len([]byte("hello")))
	_, err = conn.Read(buffer)
	if err != nil {
		t.Fatalf("Failed to read from server: %v", err)
	}

	// Verify Payload content when echoed back
	if string(buffer) != string(originalPayload.Data) {
		t.Fatalf("Expected message '%s', got '%s'", string(originalPayload.Data), string(buffer))
	}

	server.Close()
}
