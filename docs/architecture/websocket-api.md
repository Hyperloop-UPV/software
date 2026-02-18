# WebSocket API Specification

This document defines the complete WebSocket API used for communication between the backend and frontend applications (control-station, ethernet-view).

## Connection

**Endpoint**: `ws://localhost:8080/ws` (configurable in backend)  
**Protocol**: WebSocket over HTTP  
**Content-Type**: `application/json`

## Message Format

All WebSocket messages follow a consistent structure:

```json
{
    "topic": "string",
    "payload": {}
}
```

- `topic`: String identifying the message type and routing
- `payload`: Object containing topic-specific data

## Topics Reference

### Data Topics

#### `data/update`
**Direction**: Backend → Frontend  
**Purpose**: Real-time measurement data updates

```json
{
    "topic": "data/update",
    "payload": {
        "board_id": 0,
        "packet_id": 211,
        "packet_name": "vcu_regulator_packet",
        "timestamp": "2024-01-15T10:30:45.123Z",
        "measurements": {
            "measurement_name": {
                "value": "number|string|boolean",
                "type": "uint8|uint16|uint32|uint64|int8|int16|int32|int64|float32|float64|bool|enum",
                "enabled": true,
                "units": "string"
            }
        }
    }
}
```

#### `data/push`
**Direction**: Backend → Frontend  
**Purpose**: Batch data updates for chart displays

```json
{
    "topic": "data/push", 
    "payload": {
        "board_id": 0,
        "measurements": [
            {
                "name": "brake_pressure",
                "value": 85.2,
                "timestamp": "2024-01-15T10:30:45.123Z"
            }
        ]
    }
}
```

### Connection Topics

#### `connection/update`
**Direction**: Backend → Frontend  
**Purpose**: Board connection status updates

```json
{
    "topic": "connection/update",
    "payload": {
        "board_id": 0,
        "board_name": "VCU",
        "ip_address": "127.0.0.6",
        "connected": true,
        "last_seen": "2024-01-15T10:30:45.123Z",
        "packets_received": 1250,
        "bytes_received": 125000,
        "connection_quality": "excellent|good|poor|unknown"
    }
}
```

#### `connection/push`
**Direction**: Backend → Frontend  
**Purpose**: Initial connection state when client connects

```json
{
    "topic": "connection/push",
    "payload": {
        "connections": [
            {
                "board_id": 0,
                "board_name": "VCU", 
                "connected": true,
                "last_seen": "2024-01-15T10:30:45.123Z"
            }
        ]
    }
}
```

### Order Topics

#### `order/send`
**Direction**: Frontend → Backend  
**Purpose**: Send command to vehicle board

```json
{
    "topic": "order/send",
    "payload": {
        "board_id": 0,
        "order_name": "brake_engage",
        "parameters": {
            "target_pressure": 85.0,
            "engage_time": 2000
        }
    }
}
```

#### `order/state`
**Direction**: Backend → Frontend  
**Purpose**: Order execution status updates

```json
{
    "topic": "order/state",
    "payload": {
        "board_id": 0,
        "order_name": "brake_engage",
        "status": "pending|executing|completed|failed",
        "timestamp": "2024-01-15T10:30:45.123Z",
        "parameters": {
            "target_pressure": 85.0
        },
        "error_message": "string"
    }
}
```

### Logger Topics

#### `logger/enable`
**Direction**: Frontend → Backend  
**Purpose**: Start data logging

```json
{
    "topic": "logger/enable",
    "payload": {
        "log_type": "data|protection|state|order",
        "measurements": ["brake_pressure", "valve_state"],
        "log_rate": 100,
        "format": "csv|json",
        "filename": "run_001_data.csv"
    }
}
```

#### `logger/disable`
**Direction**: Frontend → Backend  
**Purpose**: Stop data logging

```json
{
    "topic": "logger/disable", 
    "payload": {
        "log_type": "data|protection|state|order"
    }
}
```

### Message Topics

#### `message/update`
**Direction**: Backend → Frontend  
**Purpose**: System messages and notifications

```json
{
    "topic": "message/update",
    "payload": {
        "id": "unique_message_id",
        "level": "info|warning|error",
        "source": "backend|vehicle|system",
        "title": "Connection Established",
        "message": "Successfully connected to VCU board",
        "timestamp": "2024-01-15T10:30:45.123Z",
        "board_id": 0,
        "auto_dismiss": true,
        "dismiss_timeout": 5000
    }
}
```

### Protection Topics

#### `protection/alert`
**Direction**: Backend → Frontend  
**Purpose**: Safety alerts and fault notifications

```json
{
    "topic": "protection/alert",
    "payload": {
        "board_id": 0,
        "packet_id": 2,
        "severity": "fault|warning|ok",
        "protection_type": "above|below|outofbounds|equals|notequals|errorhandler|timeaccumulation",
        "measurement_name": "brake_pressure",
        "current_value": 105.0,
        "threshold_value": 100.0,
        "message": "Brake pressure above safe limit",
        "timestamp": "2024-01-15T10:30:45.123Z",
        "acknowledged": false,
        "protection_id": "brake_pressure_high"
    }
}
```

### BLCU Topics (Bootloader)

#### `blcu/upload`
**Direction**: Frontend → Backend  
**Purpose**: Upload firmware to vehicle board

```json
{
    "topic": "blcu/upload",
    "payload": {
        "board_id": 0,
        "filename": "firmware_v2.1.bin",
        "file_data": "base64_encoded_data",
        "checksum": "sha256_hash"
    }
}
```

#### `blcu/download`
**Direction**: Frontend → Backend  
**Purpose**: Download file from vehicle board

```json
{
    "topic": "blcu/download",
    "payload": {
        "board_id": 0,
        "filename": "config.json",
        "destination": "local_config.json"
    }
}
```

#### `blcu/register`
**Direction**: Backend → Frontend  
**Purpose**: BLCU operation status updates

```json
{
    "topic": "blcu/register",
    "payload": {
        "board_id": 0,
        "operation": "upload|download",
        "status": "pending|in_progress|completed|failed",
        "progress": 0.65,
        "bytes_transferred": 340000,
        "total_bytes": 524288,
        "estimated_time_remaining": 45,
        "error_message": "string"
    }
}
```

## Implementation Guidelines

### Client Connection Handling

1. **Connection Establishment**: Client connects to WebSocket endpoint
2. **Topic Subscription**: Implicit subscription to all relevant topics
3. **Initial State**: Backend sends current state via `push` topics
4. **Real-time Updates**: Backend streams updates via `update` topics

### Error Handling

**Invalid Message Format**:
```json
{
    "topic": "error",
    "payload": {
        "error": "Invalid message format",
        "details": "Missing required field: topic",
        "original_message": {}
    }
}
```

**Unknown Topic**:
```json
{
    "topic": "error",
    "payload": {
        "error": "Unknown topic",
        "topic": "invalid/topic",
        "available_topics": ["data/update", "connection/update", ...]
    }
}
```

### Message Ordering

- **Data Updates**: No ordering guarantee, latest value wins
- **Order Commands**: Processed in receive order
- **Protection Alerts**: Immediate priority processing
- **Connection Updates**: Ordered by timestamp

### Rate Limiting

- **Data Updates**: Max 100 Hz per measurement
- **Order Commands**: Max 10 per second per client
- **Logger Operations**: Max 1 per second
- **BLCU Operations**: Max 1 concurrent operation per board

### Client Reconnection

1. **Automatic Reconnection**: Clients should implement exponential backoff
2. **State Resynchronization**: Backend sends current state on reconnection
3. **Message Buffer**: Backend may buffer critical messages during disconnect

## Frontend Integration

### TypeScript Types

```typescript
interface WebSocketMessage {
    topic: string;
    payload: any;
}

interface DataUpdatePayload {
    board_id: number;
    packet_id: number;
    packet_name: string;
    timestamp: string;
    measurements: Record<string, MeasurementValue>;
}

interface MeasurementValue {
    value: number | string | boolean;
    type: DataType;
    enabled: boolean;
    units?: string;
}

type DataType = 'uint8' | 'uint16' | 'uint32' | 'uint64' | 
               'int8' | 'int16' | 'int32' | 'int64' | 
               'float32' | 'float64' | 'bool' | 'enum';
```

### Usage Example

```typescript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onmessage = (event) => {
    const message: WebSocketMessage = JSON.parse(event.data);
    
    switch (message.topic) {
        case 'data/update':
            handleDataUpdate(message.payload);
            break;
        case 'connection/update':
            handleConnectionUpdate(message.payload);
            break;
        case 'protection/alert':
            handleProtectionAlert(message.payload);
            break;
    }
};

// Send order command
const orderMessage = {
    topic: 'order/send',
    payload: {
        board_id: 0,
        order_name: 'brake_engage',
        parameters: { target_pressure: 85.0 }
    }
};
ws.send(JSON.stringify(orderMessage));
```

## Security Considerations

- **No Authentication**: Current implementation assumes trusted network
- **Input Validation**: All incoming messages validated against schema
- **Rate Limiting**: Prevents message flooding attacks  
- **Connection Limits**: Maximum concurrent connections enforced
- **Origin Checking**: WebSocket origin validation recommended for production

## Performance Characteristics

- **Latency**: Typical message latency < 10ms on local network
- **Throughput**: Supports 1000+ messages/second per connection
- **Memory Usage**: ~1MB per active connection
- **CPU Usage**: Minimal overhead for message routing

This API specification should be implemented consistently across all frontend applications to ensure proper integration with the backend WebSocket server.