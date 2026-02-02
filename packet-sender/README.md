# Hyperloop Packet Sender (Rust)

A professional network packet sender for testing the Hyperloop backend and frontend. This tool simulates board communications by generating and sending packets from simulated board IPs to the backend.

## Features

- **macOS-optimized**: Special handling for macOS localhost networking
- **Proper IP simulation**: Each board uses its actual IP from the ADJ configuration
- **Multiple packet types**: Support for data, protection, and other packet types
- **Flexible generation modes**: Random, sine wave, and sequence patterns
- **Interactive CLI**: User-friendly command-line interface
- **High performance**: Built with Rust and Tokio for efficient async networking

## Architecture

The packet sender is built with a modular architecture:

- **ADJ Module**: Parses and manages board configurations
- **Network Module**: Handles UDP sockets with macOS-specific optimizations
- **Generator Module**: Creates packets with realistic data
- **CLI Module**: Provides interactive and batch operation modes

## Key Improvements Over Go Version

1. **Correct Network Configuration**: Uses actual board IPs instead of hardcoded addresses
2. **macOS Compatibility**: Proper socket options for localhost communication
3. **Type Safety**: Rust's type system prevents packet format errors
4. **Better Performance**: Zero-copy packet generation where possible
5. **Comprehensive Error Handling**: No silent failures

## Building

```bash
cargo build --release
```

## Quick Start

### Testing Without Backend

1. **Start a test listener** (in one terminal):

```bash
./target/release/packet-sender listen
# This starts a UDP listener on 127.0.0.9:8000
```

2. **Send packets** (in another terminal):

```bash
# Send random packets from BCU at 10 packets/second
./target/release/packet-sender random -b BCU -r 10

# Or use interactive mode
./target/release/packet-sender
> random BCU 20
```

## Usage

### Dev Mode vs Production Mode

The packet-sender now supports two modes:

- **Production Mode (default)**: Sends packets that can be captured by the backend's packet sniffer. Requires board IPs to be configured on network interfaces.
- **Dev Mode**: Sends packets directly to the backend's UDP server. Use this for local development.

```bash
# Production mode (for use with packet sniffer)
./target/release/packet-sender random

# Dev mode (for use with UDP server)
./target/release/packet-sender --dev random
```

### Interactive Mode

```bash
./target/release/packet-sender interactive
# Or in dev mode
./target/release/packet-sender --dev interactive
```

Interactive mode commands:

- `help` / `h` - Show available commands
- `list` / `l` - List all boards
- `board` / `b <name>` - Show board information
- `manual` / `m <board>` - Manually build and send a packet with custom values
- `random` / `r <board> [rate]` - Start random packet generation
- `simulate` / `sim` / `s <board> <mode>` - Start simulation (modes: random, sine, sequence)
- `quit` / `q` / `exit` - Exit the program

#### Manual Packet Sending

The new `manual` command provides an interactive way to send packets with custom values:

1. Select the board: `manual VCU`
2. Choose a packet from the displayed list
3. Select random or custom values
4. If custom, enter values for each variable with:
   - Type information (uint8, float32, bool, enum, etc.)
   - Valid ranges based on the data type
   - Units (if available in ADJ)
   - Safe/warning ranges (if configured in ADJ)

Example session:

```
> manual VCU
Available packets for board VCU:

Data packets:
  [1] temperature_data (ID: 100) - 3 variables
  [2] pressure_data (ID: 101) - 2 variables

Select packet number (1-2): 1

Selected packet: temperature_data (ID: 100)
This packet has 3 variables

Generate (r)andom or (c)ustom values? c

Variable: temp_sensor_1 (ID: 1001)
Type: Float32
Units: °C
Safe range: 20.0 to 80.0
32-bit floating point
Enter value: 25.5

Packet sent successfully!
```

### Random Generation

```bash
# Generate packets from all boards at 100 pps
./target/release/packet-sender random

# Generate packets from specific board at 200 pps
./target/release/packet-sender random -b BCU -r 200

# Dev mode with specific board
./target/release/packet-sender --dev random -b BCU -r 200
```

### Board Simulation

```bash
# Simulate BCU board with random data
./target/release/packet-sender board BCU --mode random

# Simulate with sine wave pattern
./target/release/packet-sender board BCU --mode sine

# Dev mode simulation
./target/release/packet-sender --dev board BCU --mode sine
```

### List Available Boards

```bash
./target/release/packet-sender list
```

## Configuration

The tool automatically loads the ADJ (Abstract Data JSON) from the backend directory. You can specify a custom path:

```bash
./target/release/packet-sender --adj-path /path/to/adj
```

## macOS-Specific Features

The packet sender includes special handling for macOS:

- Sets `SO_REUSEADDR` and `SO_REUSEPORT` for multiple binds
- Configures `SO_NOSIGPIPE` to prevent crashes
- Optimizes buffer sizes for localhost communication
- Properly handles the `lo0` loopback interface

## Packet Format

Packets follow the backend's binary format:

- 2 bytes: Packet ID (little-endian)
- Variable data based on packet type and definition

## Development

### Adding New Packet Types

1. Update the `PacketType` enum in `src/adj/packet.rs`
2. Create a new generator in `src/generator/`
3. Add handling in `PacketGenerator::generate_packet()`

### Testing with Backend

#### Production Mode (with Sniffer)

1. Start the backend with `dev_mode = false` in config.toml
2. Ensure network interfaces are configured with board IPs
3. Run the packet sender without the `--dev` flag
4. Monitor backend logs for received packets

#### Dev Mode (with UDP Server)

1. Start the backend with `dev_mode = true` in config.toml or dev-config.toml
2. Run the packet sender with the `--dev` flag
3. Monitor backend logs for received packets

## Troubleshooting

### "Address already in use" errors

- The tool sets SO_REUSEADDR/PORT, but check for other processes
- Use `lsof -i :PORT` to find conflicting processes

### Packets not reaching backend

- Verify backend is listening on the correct address/port
- Check firewall settings (especially on macOS)
- Use Wireshark to monitor localhost traffic

## Future Enhancements

- [ ] TUI mode with real-time statistics
- [ ] Packet replay from captured files
- [ ] Fault injection scenarios
- [ ] Performance benchmarking mode
- [ ] Integration tests with backend
