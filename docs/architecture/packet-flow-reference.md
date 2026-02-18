# Packet Flow Quick Reference

## Board → Backend → Frontend (Data Flow)

### 1. Binary Packet Structure
```
[Packet ID: 2 bytes (uint16, little-endian)] [Data: variable length based on ADJ]
```

### 2. Network Reception
- **TCP**: Reliable delivery for critical data
- **UDP**: High-frequency sensor data (no retransmission)
- Board IP must match ADJ configuration

### 3. Decoding Process
```go
// Simplified flow
id := readUint16(connection)          // Read 2-byte packet ID
decoder := getDecoderForId(id)        // Lookup from ADJ
packet := decoder.Decode(connection)  // Parse remaining bytes
applyUnitConversions(packet)          // Convert units if needed
```

### 4. Message Routing
```
Packet Type → Broker Topic → WebSocket Message
Data        → data/update   → {"topic": "data/update", "payload": {...}}
Protection  → protection/*  → {"topic": "protection/fault", "payload": {...}}
```

### 5. Frontend Reception
```typescript
handler.subscribe("data/update", {
    id: "unique-id",
    cb: (data) => updateUI(data)
});
```

## Frontend → Backend → Board (Order Flow)

### 1. Order Creation
```typescript
const order: Order = {
    id: 9995,  // From ADJ orders.json
    fields: {
        "ldu_id": { value: 1, isEnabled: true, type: "uint8" },
        "lcu_desired_current": { value: 2.5, isEnabled: true, type: "float32" }
    }
};
```

### 2. WebSocket Transmission
```typescript
handler.post("order/send", order);
// Sends: {"topic": "order/send", "payload": order}
```

### 3. Backend Processing
1. Receive JSON order from WebSocket
2. Validate order ID exists in ADJ
3. Create packet structure from order fields
4. Encode to binary format (little-endian)
5. Lookup target board from packet ID

### 4. Binary Encoding
```
Order ID: 9995 (0x270B)
Fields: ldu_id=1, lcu_desired_current=2.5

Binary output:
[0B 27]     // ID: 9995 in little-endian
[01]        // ldu_id: 1 (uint8)
[00 00 20 40] // lcu_desired_current: 2.5 (float32, little-endian)
```

### 5. Transmission to Board
- TCP connection to board IP (from ADJ)
- Synchronous write with error handling
- Connection status tracked

## Special Cases

### Fault Propagation (ID: 0)
```
When packet ID = 0:
1. Received from any board
2. Replicated to ALL connected boards
3. Triggers emergency stop procedures
```

### BLCU File Transfer
```
1. Frontend: handler.exchange("blcu/upload", {filename, data})
2. Backend: TFTP PUT to BLCU IP
3. Progress updates via WebSocket
4. Completion notification
```

### State Orders
```
Special orders that modify board state:
- add_state_order: Enable periodic execution
- remove_state_order: Disable periodic execution
- Managed by backend state machine
```

## Common Packet Types

### Data Packet Example (LCU Coil Current)
```
ADJ Definition (packets.json):
{
    "id": 320,
    "type": "data",
    "name": "lcu_coil_current",
    "variables": ["general_state", "vertical_state", ...]
}

Binary Format:
[40 01]     // ID: 320
[01]        // general_state (uint8)
[02]        // vertical_state (uint8)
[00 00 80 3F] // coil_current_1 (float32: 1.0)
...
```

### Protection Packet Example
```
ID Range: 1000-3999 (based on severity)
- 1xxx: Fault (critical)
- 2xxx: Warning
- 3xxx: OK (cleared)

Binary Format:
[E8 03]     // ID: 1000 (fault)
[05 00]     // Board ID: 5
[01]        // Error code
```

## Network Configuration

### Default Ports
- TCP Client: 50401 (Backend → Board)
- TCP Server: 50500 (Board → Backend)
- UDP: 50400 (Bidirectional)
- TFTP: 69 (BLCU only)
- WebSocket: 8080 (Frontend → Backend)

### IP Scheme
- Backend: 192.168.0.9
- Boards: 192.168.1.x (defined in ADJ)
- BLCU: 192.168.1.254 (typical)

## Debugging Tips

### 1. Check Packet Flow
```bash
# Monitor WebSocket messages in browser
# DevTools → Network → WS → Messages

# Backend logs
tail -f trace.json | jq 'select(.msg | contains("packet"))'
```

### 2. Verify ADJ Configuration
```bash
# Check board definition
cat adj/boards/LCU/LCU.json

# Verify packet exists
jq '.[] | select(.id == 320)' adj/boards/LCU/packets.json
```

### 3. Connection Status
- Frontend: Check connection indicator
- Backend logs: "new connection" / "close"
- Network: `netstat -an | grep 504`

### 4. Common Issues
- **No data**: Check board in config.toml vehicle.boards
- **Order fails**: Verify order ID in ADJ
- **Decode error**: Packet structure mismatch
- **Connection drops**: Network/firewall issues