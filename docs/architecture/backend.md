# Backend Architecture

The backend is a high-performance Go server managing real-time communication between pod boards and the control station frontend.

> **Note**: For complete system architecture and packet flow, see the [Control Station Complete Architecture](../../CONTROL_STATION_COMPLETE_ARCHITECTURE.md) document.

## Design Principles

- **Real-time Performance**: Sub-10ms fault detection with concurrent processing
- **Type Safety**: Strongly typed packet definitions from ADJ specifications  
- **Fault Tolerance**: Automatic reconnection and graceful degradation
- **Modular Architecture**: Clear separation of concerns across packages

## Package Structure

```
backend/
├── cmd/
│   └── main.go           # Entry point, initialization
├── internal/
│   ├── adj/             # ADJ parser and validator
│   ├── pod_data/        # Packet structure definitions
│   ├── update_factory/  # Update message creation
│   └── vehicle/         # Vehicle state management
└── pkg/
    ├── abstraction/     # Core interfaces
    ├── boards/          # Board-specific logic (BLCU)
    ├── broker/          # Message distribution
    ├── transport/       # Network communication
    ├── vehicle/         # Board coordination
    └── websocket/       # Frontend connections
```

## Core Components

### Transport Layer (`pkg/transport/`)

Manages all network I/O with pluggable handlers:

```go
// Transport coordinates all network communication
type Transport struct {
    decoder     *presentation.Decoder
    encoder     *presentation.Encoder
    connections map[TransportTarget]net.Conn
    mu          sync.RWMutex
}
```

**Key Features**:
- Thread-safe connection pooling
- Automatic reconnection with exponential backoff  
- Concurrent packet processing
- Special handling for fault propagation (packet ID 0)

### Presentation Layer

Handles binary protocol encoding/decoding:

```go
// Packet structure (little-endian)
type Packet struct {
    ID      uint16      // 2 bytes
    Payload []byte      // Variable length
}
```

**Decoding Process**:
1. Read packet ID (2 bytes)
2. Look up decoder by ID
3. Parse payload based on ADJ descriptor
4. Apply unit conversions
5. Return typed packet object

### Message Broker

Central hub for internal message routing:

```go
// Topic-based publish/subscribe
type Broker struct {
    topics map[string]Topic
    pool   *WebSocketPool
}
```

**Topic Hierarchy**:
- `data/update` - Real-time measurements
- `connection/update` - Board status  
- `order/send` - Command dispatch
- `protection/alert` - Safety notifications
- `logger/*` - Logging control
- `blcu/*` - Bootloader operations

### Vehicle Manager

Coordinates board interactions and state:

```go
type Vehicle struct {
    broker        *Broker
    logger        *Logger
    transport     *Transport
    boards        map[BoardId]Board
    updateFactory *UpdateFactory
}
```

**Responsibilities**:
- Order validation and execution
- State management
- Board registry
- Error propagation

## Concurrency Model

### Goroutine Architecture

```go
// Per-connection handler
go func(conn net.Conn) {
    defer conn.Close()
    for {
        packet := readPacket(conn)
        packetChan <- packet
    }
}()

// Packet processor
go func() {
    for packet := range packetChan {
        processPacket(packet)
    }
}()
```

### Channel Usage

- **Packet Distribution**: Buffered channels for flow control
- **Error Handling**: Dedicated error channel
- **Shutdown Coordination**: Context cancellation

## Performance Optimizations

### Network Tuning

```go
// TCP optimizations
conn.SetNoDelay(true)           // Disable Nagle
conn.SetKeepAlive(true)         // Enable keep-alive
conn.SetKeepAlivePeriod(1*time.Second)
```

### Memory Management

- **Object Pooling**: Reused packet buffers
- **Bounded Queues**: Prevent memory exhaustion
- **Zero-Copy Operations**: Minimize allocations

### Profiling Support

```bash
# CPU profiling
./backend -cpuprofile=cpu.prof

# Memory profiling  
curl http://localhost:4040/debug/pprof/heap > heap.prof

# Block profiling
./backend -blockprofile=10
```

## Configuration

### Structure (`config.toml`)

```toml
[adj]
branch = "main"
test = false

[vehicle]
boards = ["LCU", "HVSCU", "BMSL"]

[tcp]
connection_timeout = 5000
keep_alive = 1000
backoff_multiplier = 1.5

[server.control-station]
addr = "0.0.0.0:8081"
static_path = "./control-station"
```

### Environment Overrides

```bash
BACKEND_LOG_LEVEL=debug ./backend
BACKEND_ADJ_BRANCH=dev ./backend
```

## Error Handling

### Error Types

```go
// Structured errors with context
type ConnectionError struct {
    Board     string
    Addr      string
    Err       error
    Timestamp time.Time
}

func (e ConnectionError) Error() string {
    return fmt.Sprintf("[%s] board %s at %s: %v",
        e.Timestamp.Format(time.RFC3339),
        e.Board, e.Addr, e.Err)
}
```

### Recovery Strategies

1. **Connection Loss**: Exponential backoff reconnection
2. **Decode Errors**: Log and continue processing
3. **Panic Recovery**: Goroutine-level recovery
4. **Resource Exhaustion**: Circuit breakers

## Critical Issues

### 1. BLCU Hardcoding

```go
// FIXME: Move to ADJ configuration
const (
    BlcuDownloadOrderId = 701
    BlcuUploadOrderId   = 700
)
```

**Impact**: Cannot adapt to different BLCU versions  
**Solution**: Define BLCU packets in ADJ like other boards

### 2. Large Monolithic Files

- `main.go`: 800+ lines
- Complex initialization logic
- Hard to test

**Solution**: Refactor into logical modules

### 3. Test Coverage

Current coverage: ~30%  
**Critical gaps**:
- Connection failure scenarios
- Concurrent access patterns
- Edge cases in packet decoding

## Development Guidelines

### Adding New Board Types

1. Define board in ADJ:
```json
{
    "board_id": 5,
    "board_ip": "192.168.1.5",
    "measurements": ["measurements.json"],
    "packets": ["packets.json", "orders.json"]
}
```

2. Register in config.toml:
```toml
[vehicle]
boards = ["LCU", "HVSCU", "BMSL", "NEWBOARD"]
```

3. Implement board-specific logic if needed:
```go
type NewBoard struct {
    api abstraction.BoardAPI
}

func (b *NewBoard) Notify(notification abstraction.BoardNotification) {
    // Handle board-specific notifications
}
```

### Testing

```bash
# Run all tests
go test ./...

# Run with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Run specific package tests
go test -v ./pkg/transport/...

# Benchmark tests
go test -bench=. ./pkg/transport/presentation/
```

### Debugging

```bash
# Enable trace logging
./backend -trace=trace

# Enable pprof endpoints
./backend  # pprof available at localhost:4040

# Use delve debugger
dlv debug ./cmd/main.go

# Trace specific boards
tail -f trace.json | jq 'select(.board == "LCU")'
```

## Future Roadmap

### Short Term (1-2 months)
- [ ] Move BLCU configuration to ADJ
- [ ] Increase test coverage to 50%
- [ ] Refactor main.go into modules
- [ ] Add connection pooling limits

### Medium Term (3-6 months)
- [ ] Plugin system for board types
- [ ] Configuration hot reload
- [ ] Distributed deployment support
- [ ] Advanced message filtering

### Long Term (6+ months)
- [ ] GraphQL API alongside WebSocket
- [ ] Time-series database integration
- [ ] Horizontal scaling support
- [ ] Full telemetry system

---

*For complete system documentation including packet flow and troubleshooting, see the [Control Station Complete Architecture](../../CONTROL_STATION_COMPLETE_ARCHITECTURE.md).*