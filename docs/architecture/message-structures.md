# Message Structures and Communication Protocols

This document provides a comprehensive specification of all message structures and communication protocols used between the vehicle, backend, and frontend components of the Hyperloop Control Station.

## Overview

The communication system uses a three-layer architecture:

1. **Vehicle ↔ Backend**: Binary packet protocols over TCP/UDP
2. **Backend ↔ Frontend**: JSON messages over WebSocket  
3. **Internal Backend**: Go struct-based message routing

## Table of Contents

- [1. Vehicle to Backend Communication](#1-vehicle-to-backend-communication)
- [2. Backend to Frontend Communication](#2-backend-to-frontend-communication)
- [3. Backend Internal Message Flow](#3-backend-internal-message-flow)
- [4. Message Timing and Ordering](#4-message-timing-and-ordering)
- [5. Error Handling and Fault Tolerance](#5-error-handling-and-fault-tolerance)

---

## 1. Vehicle to Backend Communication

### 1.1 Transport Layer

**Protocol**: TCP (primary) and UDP (secondary)  
**Ports**: Defined in `adj/general_info.json`
- TCP_CLIENT: 50401 (backend connects to vehicle)
- TCP_SERVER: 50500 (vehicle connects to backend)  
- UDP: 8000 (bidirectional communication)
- TFTP: 69 (file transfers)

**Endianness**: Little-endian for all multi-byte fields

### 1.2 Binary Packet Structure

All packets follow this general structure:

```
Byte Offset:  0        2        4        6        8+
             |========|========|========|========|========|
             |   Packet ID     |    Payload Data...       |
             |   (uint16)      |    (variable length)     |
             |========|========|========|========|========|
```

**Packet ID**: 16-bit unsigned integer identifying the packet type (defined in ADJ specifications)

### 1.3 Incoming Message Types

#### 1.3.1 Data Packets

**Purpose**: Continuous telemetry data from vehicle sensors  
**Go Type**: `pkg/transport/packet/data.Packet`

**Binary Structure**:
```
Byte Offset:  0        2        4        6        8+
             |========|========|========|========|========|
             |   Packet ID     |    Data Values...        |
             |   (uint16)      |    (per ADJ spec)        |
             |========|========|========|========|========|
```

**Go Structure**:
```go
type Packet struct {
    id        abstraction.PacketId           // uint16 packet identifier
    values    map[ValueName]Value            // Measurement name -> value
    enabled   map[ValueName]bool             // Measurement name -> enabled state
    timestamp time.Time                      // Packet reception time
}
```

**Value Types**:
- `NumericValue[T]`: For numeric data (uint8-uint64, int8-int64, float32, float64)
- `BooleanValue`: For boolean measurements
- `EnumValue`: For discrete state values

**Example ADJ Data Packet Definition**:
```json
{
    "id": 211,
    "name": "vcu_regulator_packet", 
    "type": "data",
    "variables": ["valve_state", "reference_pressure", "actual_pressure"]
}
```

#### 1.3.2 Protection Packets

**Purpose**: Safety alerts and fault notifications  
**Go Type**: `pkg/transport/packet/protection.Packet`

**Binary Structure** (per package documentation):
```
Byte Offset:  0        8        16       24       32+
             |========|========|========|========|========|
             |   Packet ID     |  type  |  kind  |  ...   |
             |   (uint16)      | (uint8)|(uint8) |        |
             |========|========|========|========|========|
             |  Name (null-terminated string)              |
             |========|========|========|========|========|
             |  Protection Data (variable length)          |
             |========|========|========|========|========|
             |counter |counter | second | minute | hour   |
             |(uint16)|(uint16)|(uint8) |(uint8) |(uint8) |
             |========|========|========|========|========|
             |  day   | month  |       year      |
             |(uint8) |(uint8) |     (uint16)     |
             |========|========|========|========|
```

**Go Structure**:
```go
type Packet struct {
    id        abstraction.PacketId    // Packet identifier
    Type      Type                    // Data type being protected
    Kind      Kind                    // Protection condition type
    Name      string                  // Human-readable protection name
    Data      Data                    // Protection-specific data
    Timestamp *Timestamp              // RTC timestamp from vehicle
    severity  Severity                // Protection severity level
}
```

**Protection Types**:
- `FaultSeverity`: Critical faults requiring immediate system shutdown
- `WarningSeverity`: Warnings requiring operator attention
- `OkSeverity`: Recovery from previous fault/warning state

**Protection Kinds**:
- `BelowKind`: Value below threshold
- `AboveKind`: Value above threshold  
- `OutOfBoundsKind`: Value outside acceptable range
- `EqualsKind`: Value equals specific condition
- `NotEqualsKind`: Value doesn't equal expected condition
- `ErrorHandlerKind`: System error condition
- `TimeAccumulationKind`: Time-based accumulation fault
- `WarningKind`: General warning condition

#### 1.3.3 State Space Packets

**Purpose**: Control system state information  
**Go Type**: `pkg/transport/packet/state.Space`

**Go Structure**:
```go
type Space struct {
    id    abstraction.PacketId    // Packet identifier  
    state [8][15]float32         // 8x15 state matrix
}
```

**Usage**: Contains control parameters and state variables used by the vehicle's control algorithms.

#### 1.3.4 BLCU Packets

**Purpose**: Bootloader Communication Unit responses  
**Go Type**: `pkg/transport/packet/blcu.Packet`

**Usage**: Handles firmware update acknowledgments and bootloader communication during vehicle programming operations.

### 1.4 Outgoing Message Types

#### 1.4.1 Order Packets

**Purpose**: Commands sent from backend to vehicle  
**Go Types**: `pkg/transport/packet/order.Add`, `pkg/transport/packet/order.Remove`

**Add Order Structure**:
```go
type Add struct {
    id     abstraction.PacketId      // Packet identifier
    orders []abstraction.PacketId    // List of order IDs to enable
}
```

**Remove Order Structure**:
```go
type Remove struct {
    id     abstraction.PacketId      // Packet identifier  
    orders []abstraction.PacketId    // List of order IDs to disable
}
```

**Example ADJ Order Definition**:
```json
{
    "type": "order",
    "name": "Brake Command", 
    "variables": ["brake_command", "target_pressure"]
}
```

### 1.5 File Transfer Protocol

**Protocol**: TFTP (Trivial File Transfer Protocol)  
**Port**: 69  
**Go Types**: `FileWriteMessage`, `FileReadMessage`

**File Write (Backend → Vehicle)**:
```go
type FileWriteMessage struct {
    filename string      // Target filename on vehicle
    io.Reader           // File content source
}
```

**File Read (Vehicle → Backend)**:
```go
type FileReadMessage struct {
    filename string      // Source filename on vehicle  
    io.Writer           // File content destination
}
```

**Usage**: Primarily used for firmware updates and configuration file transfers.

---

## 2. Backend to Frontend Communication

### 2.1 Transport Layer

**Protocol**: WebSocket over HTTP  
**Content Type**: JSON  
**Go Type**: `pkg/websocket.Message`

### 2.2 WebSocket Message Structure

**Base Message Format**:
```go
type Message struct {
    Topic   abstraction.BrokerTopic `json:"topic"`      // Message routing topic
    Payload json.RawMessage         `json:"payload"`    // Topic-specific data
}
```

**JSON Wire Format**:
```json
{
    "topic": "data/update",
    "payload": { /* topic-specific payload */ }
}
```

### 2.3 Message Topics

#### 2.3.1 Data Update Messages

**Topic**: `"data/update"`  
**Direction**: Backend → Frontend  
**Purpose**: Real-time sensor data updates

**Payload Structure**:
```json
{
    "board_id": 0,
    "packet_id": 211,
    "packet_name": "vcu_regulator_packet",
    "timestamp": "2024-01-15T10:30:45.123Z",
    "measurements": {
        "valve_state": {
            "value": "open",
            "type": "enum",
            "enabled": true
        },
        "reference_pressure": {
            "value": 8.5,
            "type": "float32", 
            "enabled": true,
            "units": "bar"
        },
        "actual_pressure": {
            "value": 8.3,
            "type": "float32",
            "enabled": true, 
            "units": "bar"
        }
    }
}
```

#### 2.3.2 Connection Status Messages

**Topic**: `"connection/update"`  
**Direction**: Backend → Frontend  
**Purpose**: Vehicle connection status updates

**Payload Structure**:
```json
{
    "board_id": 0,
    "board_name": "VCU",
    "ip_address": "127.0.0.6",
    "connected": true,
    "last_seen": "2024-01-15T10:30:45.123Z",
    "packets_received": 1250,
    "connection_quality": "excellent"
}
```

#### 2.3.3 Protection Messages

**Topic**: `"protection/alert"`  
**Direction**: Backend → Frontend  
**Purpose**: Safety alerts and fault notifications

**Payload Structure**:
```json
{
    "board_id": 0,
    "packet_id": 2,
    "severity": "fault",
    "protection_type": "above",
    "measurement_name": "brake_pressure",
    "current_value": 105.0,
    "threshold_value": 100.0,
    "message": "Brake pressure above safe limit",
    "timestamp": "2024-01-15T10:30:45.123Z",
    "acknowledged": false
}
```

#### 2.3.4 Order Status Messages

**Topic**: `"order/state"`  
**Direction**: Backend → Frontend  
**Purpose**: Command execution status updates

**Payload Structure**:
```json
{
    "board_id": 0,
    "order_name": "brake_engage",
    "status": "executed",
    "timestamp": "2024-01-15T10:30:45.123Z",
    "parameters": {
        "target_pressure": 85.0
    }
}
```

#### 2.3.5 Logger Messages

**Topic**: `"logger/enable"`, `"logger/disable"`  
**Direction**: Frontend → Backend  
**Purpose**: Control data logging

**Enable Payload**:
```json
{
    "measurements": ["brake_pressure", "valve_state"],
    "log_rate": 100,
    "format": "csv"
}
```

**Disable Payload**:
```json
{
    "stop_logging": true
}
```

#### 2.3.6 BLCU Messages

**Topic**: `"blcu/upload"`, `"blcu/download"`  
**Direction**: Bidirectional  
**Purpose**: Bootloader operations

**Upload Request Payload**:
```json
{
    "board_id": 0,
    "filename": "firmware_v2.1.bin",
    "file_size": 524288,
    "checksum": "a1b2c3d4"
}
```

**Upload Status Payload**:
```json
{
    "board_id": 0,
    "operation": "upload",
    "status": "in_progress",
    "progress": 0.65,
    "bytes_transferred": 340000,
    "estimated_time_remaining": 45
}
```

---

## 3. Backend Internal Message Flow

### 3.1 Transport Layer Messages

**Go Type**: `transport.PacketMessage`, `transport.FileWriteMessage`, `transport.FileReadMessage`

**Internal Message Events**:
- `PacketEvent`: Packet send/receive operations
- `ErrorEvent`: Transport layer errors
- `FileWriteEvent`: TFTP write requests
- `FileReadEvent`: TFTP read requests

### 3.2 Broker System

**Architecture**: Topic-based message routing  
**Go Type**: `pkg/broker.Broker`

**Message Flow**:
1. Transport layer receives packet from vehicle
2. Packet decoded via presentation layer (`pkg/transport/presentation.Decoder`)
3. Packet routed to appropriate board handler via broker
4. Board handler processes packet and generates WebSocket messages
5. WebSocket messages broadcast to connected frontend clients

### 3.3 Vehicle Management

**Go Type**: `pkg/vehicle.Vehicle`

**Responsibilities**:
- Board lifecycle management
- Order execution coordination  
- State space management
- Protection system coordination

---

## 4. Message Timing and Ordering

### 4.1 Data Packet Timing

**Frequency**: Variable per packet type, typically 10-100 Hz  
**Buffering**: Session-level buffering for network packet reassembly  
**Ordering**: Packets processed in receive order, timestamped on arrival

### 4.2 Protection Message Priority

**Priority Order**:
1. Fault messages (immediate processing)
2. Warning messages (high priority queue)
3. OK messages (normal priority queue)

### 4.3 Order Execution Timing

**Request Flow**:
1. Frontend sends order via WebSocket
2. Backend validates order parameters
3. Backend sends binary order packet to vehicle
4. Vehicle acknowledgment expected within 1 second
5. Status update sent to frontend

---

## 5. Error Handling and Fault Tolerance

### 5.1 Network Error Handling

**TCP Connection Failures**:
- Automatic reconnection with exponential backoff
- Connection status broadcast to frontend
- Packet queuing during disconnection

**UDP Packet Loss**:
- No retransmission (fire-and-forget)
- Packet sequence tracking for loss detection
- Statistics reporting to frontend

### 5.2 Protocol Error Handling

**Invalid Packet Format**:
- Packet discarded with error logging
- Decoder error recovery to next packet boundary
- Error statistics tracked per board

**Unknown Packet IDs**:
- Warning logged with packet ID
- Packet contents logged for debugging
- Connection maintained

### 5.3 ADJ Configuration Errors

**Missing Measurements**:
- Default value substitution where possible
- Warning alerts to operators
- Graceful degradation of functionality

**Invalid Board Configuration**:
- Board disabled with error notification
- System continues with remaining boards
- Configuration reload capability

---

## Implementation Notes

### Network Layer

The network implementation (`pkg/transport/network/`) provides:
- **TCP Client/Server**: Reliable packet delivery
- **UDP**: Fast, unreliable communication for high-frequency data
- **TFTP**: File transfer capabilities
- **Packet Sniffer**: Network traffic monitoring and debugging

### Presentation Layer

The presentation layer (`pkg/transport/presentation/`) handles:
- **Packet ID routing**: Maps packet IDs to appropriate decoders
- **Binary decoding**: Converts binary data to Go structs
- **Encoder support**: Converts Go structs to binary for transmission

### Data Types

All data types support:
- **Type safety**: Strong typing prevents runtime errors
- **JSON serialization**: Automatic conversion for WebSocket transmission
- **Value validation**: Range checking and enum validation
- **Unit conversion**: Automatic conversion between pod and display units

This documentation should be kept synchronized with ADJ specification changes and backend implementation updates.