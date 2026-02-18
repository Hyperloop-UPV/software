# Communication Protocols Overview

This document provides a high-level overview of all communication protocols used in the Hyperloop Control Station system.

## Architecture Overview

The system uses a three-layer communication architecture:

```
┌─────────────┐    Binary Protocol     ┌─────────────┐    WebSocket API    ┌─────────────┐
│   Vehicle   │ ◄─────────────────────► │   Backend   │ ◄─────────────────► │  Frontend   │
│   Systems   │   TCP/UDP + TFTP       │   Server    │      JSON/WS        │ Applications │
└─────────────┘                        └─────────────┘                     └─────────────┘
```

## Layer 1: Vehicle ↔ Backend Communication

### Transport Protocols
- **TCP**: Reliable command/control messages
- **UDP**: High-frequency sensor data
- **TFTP**: File transfers (firmware, configs)

### Message Types
1. **Data Packets**: Sensor measurements and telemetry
2. **Protection Packets**: Safety alerts and fault notifications
3. **Order Packets**: Commands from backend to vehicle
4. **State Space Packets**: Control system matrices
5. **BLCU Packets**: Bootloader communication

### Key Characteristics
- **Binary Encoding**: Efficient, compact representation
- **Little-Endian**: Consistent byte ordering
- **Real-Time**: Sub-10ms latency for critical messages
- **ADJ-Defined**: Message structure defined by JSON specifications

**Detailed Specification**: [Binary Protocol](./binary-protocol.md)

## Layer 2: Backend ↔ Frontend Communication

### Transport Protocol
- **WebSocket**: Full-duplex communication over HTTP
- **JSON Encoding**: Human-readable, self-describing messages

### Topic-Based Routing
Messages are routed by topic strings:
- `data/*`: Measurement data and updates
- `connection/*`: Network status and board connectivity  
- `order/*`: Command execution and status
- `protection/*`: Safety alerts and acknowledgments
- `logger/*`: Data logging control
- `blcu/*`: Bootloader operations
- `message/*`: System notifications

### Key Characteristics
- **Real-Time**: WebSocket enables instant updates
- **Bidirectional**: Frontend can send commands to backend
- **Type-Safe**: Structured JSON schemas
- **Scalable**: Multiple frontend clients supported

**Detailed Specification**: [WebSocket API](./websocket-api.md)

## Layer 3: Backend Internal Architecture

### Message Broker System
The backend uses a topic-based message broker to route data between components:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Transport  │ -> │   Broker    │ -> │  WebSocket  │
│   Layer     │    │   System    │    │   Clients   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                  │                   │
       │                  ▼                   │
       │           ┌─────────────┐            │
       │           │   Vehicle   │            │
       └─────────> │ Management  │ <──────────┘
                   └─────────────┘
```

### Data Flow

1. **Incoming Path** (Vehicle → Frontend):
   ```
   Vehicle Binary Packet → Transport Decoder → Message Broker → WebSocket JSON
   ```

2. **Outgoing Path** (Frontend → Vehicle):
   ```
   WebSocket JSON → Message Broker → Vehicle Manager → Transport Encoder → Binary Packet
   ```

## Message Categories and Timing

### Real-Time Data (High Frequency)
- **Data Packets**: 10-100 Hz per measurement
- **Protection Alerts**: Immediate (fault conditions)
- **Connection Status**: On change + 1 Hz heartbeat
- **Transport**: UDP preferred for speed

### Command and Control (Low Frequency)
- **Order Commands**: As needed (user-initiated)
- **Logger Control**: Manual operation
- **Configuration Changes**: Manual operation  
- **Transport**: TCP required for reliability

### File Operations (Occasional)
- **Firmware Updates**: Manual operation
- **Configuration Files**: Manual operation
- **Log Downloads**: Manual operation
- **Transport**: TFTP for large data transfers

## Network Configuration

### Port Assignments
```
Service         Port    Protocol   Direction
─────────────────────────────────────────────
TCP Client      50401   TCP        Backend → Vehicle
TCP Server      50500   TCP        Vehicle → Backend  
UDP Data        8000    UDP        Bidirectional
TFTP Files      69      UDP        Bidirectional
SNTP Time       123     UDP        Vehicle → NTP Server
WebSocket API   8080    TCP/HTTP   Frontend → Backend
```

### IP Address Scheme
- **Backend**: 127.0.0.9 (default, configurable)
- **Vehicle Boards**: Per-board IPs defined in ADJ config
  - VCU: 127.0.0.6
  - BCU: 127.0.0.7  
  - LCU: 127.0.0.8
  - etc.

## Protocol Evolution and Versioning

### ADJ Specification Versioning
- **Current Version**: ADJ v2
- **Backward Compatibility**: v1 configs automatically migrated
- **Schema Evolution**: Additive changes only for compatibility

### Protocol Versioning
- **Binary Protocol**: Version embedded in packet structure
- **WebSocket API**: Version negotiation during connection
- **Error Handling**: Graceful degradation for unknown message types

## Security Considerations

### Current Implementation
- **Trusted Network**: Assumes secure LAN environment
- **No Authentication**: Direct connection without credentials
- **Input Validation**: All messages validated against schema
- **Rate Limiting**: Prevents message flooding

### Production Recommendations
- **TLS Encryption**: Secure WebSocket connections (WSS)
- **Authentication**: Token-based client authentication
- **Authorization**: Role-based access control
- **Network Isolation**: Dedicated VLAN for vehicle communication

## Error Handling and Fault Tolerance

### Network-Level Errors
- **TCP Disconnection**: Automatic reconnection with exponential backoff
- **UDP Packet Loss**: Statistics tracking, no retransmission
- **WebSocket Disconnect**: Client reconnection with state resync

### Protocol-Level Errors
- **Malformed Packets**: Graceful error recovery and logging
- **Unknown Message Types**: Warning logged, connection maintained
- **Schema Validation**: Invalid messages rejected with error response

### Application-Level Errors
- **Board Offline**: Connection status propagated to frontend
- **Protection Faults**: Immediate alert propagation with acknowledgment tracking
- **Command Failures**: Error status returned to frontend client

## Performance Characteristics

### Latency
- **Vehicle → Frontend**: < 20ms typical
- **Frontend → Vehicle**: < 50ms typical  
- **Protection Alerts**: < 5ms critical path

### Throughput
- **Data Rate**: 1000+ measurements/second supported
- **Concurrent Clients**: 10+ frontend connections
- **Packet Rate**: 500+ packets/second per board

### Memory Usage
- **Per Connection**: ~1MB WebSocket client
- **Packet Buffers**: 64KB per transport connection
- **Message Queue**: Bounded queues prevent memory leaks

## Monitoring and Debugging

### Built-in Diagnostics
- **Connection Statistics**: Packet counts, error rates, latency
- **Message Logs**: Structured logging with correlation IDs
- **Performance Metrics**: Throughput and latency monitoring

### Debug Tools
- **Packet Sender**: Test packet generation for development
- **Ethernet View**: Real-time protocol monitoring
- **Network Captures**: PCAP files for detailed analysis

### Logging Integration
- **Structured Logging**: JSON format with contextual information
- **Log Levels**: Debug, info, warning, error, critical
- **Log Rotation**: Automatic archival of historical data

## Development Guidelines

### Adding New Message Types

1. **Update ADJ Specification**: Define packet structure in JSON
2. **Implement Backend Decoder**: Add packet parsing logic
3. **Define WebSocket Topic**: Specify JSON message format
4. **Update Frontend Types**: TypeScript interfaces for type safety
5. **Add Documentation**: Update protocol specifications

### Testing Protocol Changes

1. **Unit Tests**: Individual packet codec validation
2. **Integration Tests**: End-to-end message flow verification
3. **Load Testing**: Performance validation under stress
4. **Compatibility Testing**: Ensure backward compatibility

### Best Practices

- **Schema Evolution**: Only additive changes to maintain compatibility
- **Error Handling**: Graceful degradation for unknown message types
- **Documentation**: Keep specifications synchronized with implementation
- **Versioning**: Clear version tracking for all protocol changes

## Related Documentation

- [Message Structures](./message-structures.md) - Detailed structure specifications
- [Binary Protocol](./binary-protocol.md) - Vehicle communication details
- [WebSocket API](./websocket-api.md) - Frontend communication details
- [ADJ Specification](../../packet-sender/adj/README.md) - Configuration format
- [Development Guide](../development/DEVELOPMENT.md) - Setup and workflow

This protocol overview provides the foundation for understanding all communication aspects of the Hyperloop Control Station system.