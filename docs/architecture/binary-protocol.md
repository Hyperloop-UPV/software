# Binary Protocol Specification

This document defines the binary wire protocol used for communication between vehicle boards and the backend.

## Protocol Overview

All communication uses a simple, efficient binary protocol with fixed headers and variable-length payloads.

### Endianness
**All multi-byte values use little-endian byte order.**

### Packet Structure
```
┌─────────────┬─────────────────────────┐
│ Header (2B) │ Payload (variable)      │
├─────────────┼─────────────────────────┤
│ Packet ID   │ Data fields per ADJ     │
│ (uint16)    │ specification           │
└─────────────┴─────────────────────────┘
```

## Data Type Encoding

### Numeric Types
| Type | Size | Range | Encoding |
|------|------|-------|----------|
| uint8 | 1 byte | 0 to 255 | Raw byte |
| uint16 | 2 bytes | 0 to 65,535 | Little-endian |
| uint32 | 4 bytes | 0 to 4,294,967,295 | Little-endian |
| uint64 | 8 bytes | 0 to 18,446,744,073,709,551,615 | Little-endian |
| int8 | 1 byte | -128 to 127 | Two's complement |
| int16 | 2 bytes | -32,768 to 32,767 | Two's complement, little-endian |
| int32 | 4 bytes | -2,147,483,648 to 2,147,483,647 | Two's complement, little-endian |
| int64 | 8 bytes | -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807 | Two's complement, little-endian |
| float32 | 4 bytes | IEEE 754 single precision | Little-endian |
| float64 | 8 bytes | IEEE 754 double precision | Little-endian |

### Boolean Type
- Encoded as uint8: 0 = false, non-zero = true

### Enum Type
- Encoded as uint8 representing the index in the enum definition

## Packet Categories

### 1. Data Packets (Board → Backend)
Used for sensor measurements and telemetry.

#### Example: Temperature Sensor
```
ADJ Definition:
{
    "id": 100,
    "variables": ["sensor_id", "temperature", "timestamp"]
}

Measurements:
- sensor_id: uint8
- temperature: float32 (°C)
- timestamp: uint32 (milliseconds)

Binary encoding:
64 00        // Packet ID: 100
01           // sensor_id: 1
CD CC 8C 41  // temperature: 17.6°C (float32)
10 27 00 00  // timestamp: 10000ms
```

### 2. Protection Packets (Board → Backend)
Safety-critical notifications with severity levels.

#### Packet ID Ranges
- 1000-1999: Fault (critical failures)
- 2000-2999: Warning (non-critical issues)
- 3000-3999: OK (cleared conditions)

#### Structure
```
┌──────────────┬──────────────┬──────────────┐
│ Packet ID    │ Board ID     │ Error Code   │
│ (uint16)     │ (uint16)     │ (uint8)      │
└──────────────┴──────────────┴──────────────┘
```

#### Example: Overheat Fault
```
E8 03  // ID: 1000 (fault)
04 00  // Board ID: 4 (LCU)
15     // Error code: 21 (overheat)
```

### 3. Order Packets (Backend → Board)
Commands sent from backend to boards.

#### Example: Set Current
```
ADJ Definition:
{
    "id": 9995,
    "variables": ["ldu_id", "lcu_desired_current"]
}

Binary encoding:
0B 27        // ID: 9995
02           // ldu_id: 2
00 00 20 40  // desired_current: 2.5A (float32)
```

### 4. State Order Packets
Special packets for managing periodic order execution.

#### Add State Order (Enable periodic execution)
```
Structure:
┌──────────────┬──────────────┬──────────────┐
│ Packet ID    │ Board Name   │ Order IDs    │
│ (uint16)     │ Length + Str │ Count + List │
└──────────────┴──────────────┴──────────────┘

Example:
05 00        // ID: 5 (add_state_order)
03           // String length: 3
4C 43 55     // "LCU"
02 00        // Order count: 2
0B 27        // Order ID: 9995
0C 27        // Order ID: 9996
```

#### Remove State Order (Disable periodic execution)
Same structure as Add State Order but with ID 6.

### 5. BLCU Packets
Special packets for bootloader operations.

#### Download Order (ID: 50)
```
32 00        // ID: 50
[filename]   // Null-terminated string
[file_size]  // uint32
[checksum]   // uint32
```

#### Upload Order (ID: 51)
```
33 00        // ID: 51
[filename]   // Null-terminated string
```

## Special Packet IDs

### ID 0: Fault Propagation
When any board sends a packet with ID 0, the backend immediately replicates it to all connected boards. This enables system-wide emergency stop.

```
00 00        // ID: 0 (emergency stop)
[payload]    // Board-specific fault data
```

## Unit Conversions

The protocol supports automatic unit conversions between pod units and display units.

### Conversion Operations
- `*X`: Multiply by X
- `/X`: Divide by X
- `+X`: Add X
- `-X`: Subtract X

### Example: Temperature Conversion
```
Pod units: Celsius
Display units: Kelvin
Conversion: "+273.15"

Wire value: 25.0°C (float32: 0x41C80000)
Display value: 298.15K
```

## Transport Protocols

### TCP (Reliable Commands)
- Used for: Orders, critical data, connection management
- Port: 50500 (board → backend), 50401 (backend → board)
- Features: Guaranteed delivery, order preservation

### UDP (High-Speed Data)
- Used for: Sensor data, non-critical telemetry
- Port: 50400
- Features: Low latency, no retransmission

## Error Handling

### Malformed Packets
- Invalid packet ID: Log and drop
- Incorrect length: Close connection
- Decode failure: Send protection fault

### Connection Errors
- TCP disconnect: Automatic reconnection
- UDP packet loss: Update statistics
- Timeout: Configurable retry logic

## Performance Considerations

### Packet Size Limits
- TCP: No inherent limit (fragmented as needed)
- UDP: 1500 bytes (Ethernet MTU)
- Recommended: Keep packets under 1000 bytes

### Throughput
- Design target: 1000+ packets/second per board
- Actual limit: Network and processing dependent

### Latency
- TCP: ~1-5ms typical
- UDP: <1ms typical
- Critical path (protection): <5ms requirement

## Security Notes

### Current Implementation
- No encryption (trusted network assumed)
- No authentication
- Basic validation only

### Recommendations
- Add packet signing for critical commands
- Implement sequence numbers
- Consider TLS for external connections

## Debugging

### Packet Capture
Use Wireshark with these filters:
```
# All pod traffic
ip.addr == 192.168.1.0/24

# Specific board
ip.addr == 192.168.1.4

# UDP sensor data only
udp.port == 50400
```

### Common Issues
1. **Byte order mismatch**: Check endianness
2. **Packet truncation**: Verify buffer sizes
3. **ID not recognized**: Check ADJ configuration
4. **Float precision**: Use float32 unless needed

## Implementation Notes

### C/C++ (Firmware)
```c
// Pack structure (GCC)
struct __attribute__((packed)) DataPacket {
    uint16_t id;
    uint8_t sensor_id;
    float temperature;
    uint32_t timestamp;
};
```

### Go (Backend)
```go
// Use encoding/binary
binary.Write(buffer, binary.LittleEndian, packet)
```

### Python (Testing)
```python
# Use struct module
import struct
data = struct.pack('<HBfI', id, sensor_id, temp, timestamp)
```