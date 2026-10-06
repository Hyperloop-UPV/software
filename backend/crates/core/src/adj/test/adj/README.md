# ADJ v2 Specification

This document defines the ADJ v2 configuration format used by the Hyperloop Control Station. The configuration is organized as a distributed collection of JSON files that define boards, measurements, packets, and general system information.

## File Structure

The ADJ configuration is organized in the following directory structure:

```
adj/
├── general_info.json      # System-wide configuration
├── boards.json           # Board list and path mappings
└── boards/               # Board-specific configurations
    └── {board_name}/
        ├── {board_name}.json           # Main board configuration
        ├── {board_name}_measurements.json  # Board measurements
        ├── packets.json                # Data packets
        ├── orders.json                 # Order packets
        └── sockets.json                # Board sockets
```

## Data Types

### General Info (`general_info.json`)

System-wide configuration including ports, addresses, units, and message IDs.

```json
{
    "ports": {
        "string": "number"
    },
    "addresses": {
        "string": "string"
    },
    "units": {
        "string": "string"
    },
    "message_ids": {
        "string": "number"
    }
}
```

**Example:**
```json
{
    "ports": {
        "main": 8080,
        "data": 8081
    },
    "addresses": {
        "primary": "192.168.1.100",
        "secondary": "192.168.1.101"
    },
    "units": {
        "pressure": "PSI",
        "temperature": "°C",
        "voltage": "V"
    },
    "message_ids": {
        "status": 1,
        "data": 2
    }
}
```

### Board List (`boards.json`)

Mapping of board names to their configuration file paths.

```json
{
    "string": "string"
}
```

**Example:**
```json
{
    "brake_board": "boards/brake_board/brake_board.json",
    "sensor_board": "boards/sensor_board/sensor_board.json"
}
```

### Board Configuration (`{board_name}.json`)

Main board configuration including ID, IP address, and references to measurements, packets and sockets files.

```json
{
    "board_id": "number",
    "board_ip": "string",
    "measurements": ["string"],
    "packets": ["string"],
    "sockets": ["string"]
}
```

**Field Descriptions:**
- `board_id`: Unique 32-bit unsigned integer identifier for the board
- `board_ip`: IP address string for network communication
- `measurements`: Array of measurement file paths relative to board directory
- `packets`: Array of packet file paths relative to board directory

**Example:**
```json
{
    "board_id": 1001,
    "board_ip": "192.168.1.10",
    "measurements": ["brake_board_measurements.json"],
    "packets": ["packets.json", "orders.json"],
    "sockets":["sockets.json"]
}
```

### Measurements (`{board_name}_measurements.json`)

Array of measurement definitions for data collection and monitoring.

```json
[
    {
        "id": "string",
        "name": "string",
        "type": "string",
        "podUnits": "string?",
        "displayUnits": "string?",
        "enumValues": ["string"]?,
        "safeRange": "[number, number]?",
        "warningRange": "[number, number]?"
    }
]
```

**Field Descriptions:**
- `id`: Unique string identifier for the measurement
- `name`: Human-readable display name
- `type`: Data type - one of: `uint8`, `uint16`, `uint32`, `uint64`, `int8`, `int16`, `int32`, `int64`, `float32`, `float64`
- `podUnits`: Optional pod-side units (references `general_info.units`)
- `displayUnits`: Optional display units (references `general_info.units`)
- `enumValues`: Optional array of enumeration values for discrete measurements
- `safeRange`: Optional two-element array `[min, max]` defining safe operating range
- `warningRange`: Optional two-element array `[min, max]` defining warning thresholds

**Example:**
```json
[
    {
        "id": "brake_pressure",
        "name": "Brake Pressure",
        "type": "float32",
        "podUnits": "PSI",
        "displayUnits": "PSI",
        "safeRange": [0.0, 100.0],
        "warningRange": [80.0, 95.0]
    },
    {
        "id": "brake_status",
        "name": "Brake Status",
        "type": "uint8",
        "enumValues": ["released", "engaged", "error"]
    }
]
```

### Packets (`packets.json`, `orders.json`)

Array of packet definitions for network communication. Packets are separated by type:
- `packets.json`: Data packets for telemetry and status
- `orders.json`: Command packets for control operations

```json
[
    {
        "id": "number?",
        "type": "string",
        "name": "string",
        "variables": ["string"],
        "period_type": "us/ms?",
        "period": "number?",
        "socket": "string?"
    }
]
```

**Field Descriptions:**
- `id`: Optional 32-bit unsigned integer packet identifier
- `type`: Packet type string (e.g., "data", "order", "status")
- `name`: Human-readable packet name
- `variables`: Array of variable names/measurement IDs included in this packet
- `period_type`: Optional string specifying the type of measurement for period, either microseconds
or milliseconds
- `period`: Optional number specifying the transmission period in milliseconds or microseconds for periodic packets. Can be an integer or floating-point value
- `socket`: Optinal string that should match the name of the socket you want to transmit this packet trhough

**Example:**
```json
[
    {
        "id": 2001,
        "type": "data",
        "name": "Brake Telemetry",
        "variables": ["brake_pressure", "brake_status", "brake_temperature"],
        "period_type":"ms",
        "period": 16.67,
        "socket": "control_station_udp"
    },
    {
        "type": "order",
        "name": "Brake Command",
        "variables": ["brake_command", "target_pressure"]
    }
]
```

### Sockets (`sockets.json`)

Array of socket definitions for network communication.

```json
{
    "type": "string",
    "name": "string",
    "port": "number?",
    "local_port":"number?",
    "remote_ip": "string?",
    "remote_port":"number?"
    
}
```

**Field Descriptions:**
- `type`: Socket type string(e.g., "ServerSocket","DatagramSocket","Socket")
- `name`: Socket name
- `port`: Optional number that describes the port number used for a ServerSocket or a DatagramSocket
- `local_port`: Optional number that describes the local port number used for a Socket
- `remote_ip`: Optional string that describes the remote ip you want to connect to in a DatagramSocket or Socket
- `remote_port`:  Optional number that describes the remote port number used for a Socket

**Example:**
```json
[
    {
        "type": "ServerSocket",
        "name": "control_station_tcp",
        "port": 50500
    },

    {
        "type": "DatagramSocket",
        "name": "control_station_udp",
        "remote_ip":"192.168.0.9",
        "port": 50400
    },

    {
        "type": "Socket",
        "name": "pcu_tcp",
        "local_port": 50501,
        "remote_ip": "192.168.1.5",
        "remote_port": 50500  
    }
]
```

## Configuration Rules

1. **Naming Convention**: Board directories and main configuration files must use the same name as the board key in `boards.json`

2. **File References**: All file paths in board configurations are relative to the board's directory

3. **Measurement References**: Packet `variables` arrays should reference measurement `id` values defined in the board's measurements files

4. **Unit References**: Measurement `podUnits` and `displayUnits` should reference keys defined in `general_info.units`

5. **ID Uniqueness**: Board IDs must be unique across all boards. Packet IDs should be unique within their type category.

6. **Socket Naming**: The sockets referenced inside the packet definitions must use exact names as defined in `socket.json`.

## Validation Notes

- All numeric fields use standard JSON number format
- Optional fields may be omitted entirely or set to `null`
- Empty arrays are permitted for measurements and packets
- File paths use forward slashes (`/`) regardless of operating system
- IP addresses must be valid IPv4 format strings

## Backward Compatibility

This specification maintains compatibility with existing ADJ v1 configurations while supporting the new distributed file structure introduced in v2. The system can automatically migrate v1 configurations to the v2 format.
