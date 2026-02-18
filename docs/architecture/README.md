# System Architecture

The Hyperloop UPV Control Station is a real-time monitoring and control system for pod operations.

## Quick Links
- 📖 **[Complete Architecture Guide](../../CONTROL_STATION_COMPLETE_ARCHITECTURE.md)** - Comprehensive system documentation
- 🔄 **[Packet Flow Reference](packet-flow-reference.md)** - Quick reference for data flow
- 📡 **[Communication Protocols](protocols.md)** - Network protocol specifications
- 🐛 **[Known Issues](issues-and-improvements.md)** - Current limitations and roadmap

## Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Pod Boards    │◄──►│  Backend (Go)   │◄──►│ Frontend (React)│
│                 │    │                 │    │                 │
│ • Sensors       │    │ • TCP/UDP       │    │ • Control UI    │
│ • Actuators     │    │ • Processing    │    │ • Monitoring    │
│ • Controllers   │    │ • WebSocket     │    │ • Logging       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                      │                      ▲
         │                      ▼                      │
         │            ┌─────────────────┐              │
         └────────────│  ADJ Config     │──────────────┘
                      │  (JSON specs)   │
                      └─────────────────┘
```

## Core Components

### Backend (Go)
High-performance server managing real-time communication and data processing.
- **Location**: [`backend/`](../../backend)
- **Key Features**: Concurrent packet processing, automatic reconnection, sub-10ms response time
- **Documentation**: [Backend Architecture](backend.md)

### Frontend (React/TypeScript)  
Modern web interfaces for system monitoring and control.
- **Locations**: [`control-station/`](../../control-station), [`ethernet-view/`](../../ethernet-view)
- **Key Features**: Real-time updates, interactive controls, data visualization
- **Documentation**: [Frontend Architecture](frontend.md)

### ADJ System
JSON-based configuration defining all communication specifications.
- **Location**: [`adj/`](https://github.com/HyperloopUPV-H8/adj) (external repository)
- **Purpose**: Board definitions, packet structures, unit conversions
- **Documentation**: [ADJ Specification](../../backend/internal/adj/README.md)

## Key Capabilities

- **Real-time Performance**: 100+ Mbps data processing, <10ms fault detection
- **Modular Design**: Board-agnostic architecture using ADJ specifications  
- **Fault Tolerance**: Automatic reconnection, graceful degradation
- **Scalability**: Supports 10+ concurrent board connections

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Backend | Go 1.21+ | High-performance networking and concurrency |
| Frontend | React 18 + TypeScript | Type-safe UI development |
| Communication | WebSocket | Real-time bidirectional updates |
| Configuration | JSON (ADJ) | Flexible system specification |
| Networking | TCP/UDP/TFTP | Reliable and fast data transfer |

## Documentation Index

### Architecture Details
- [Backend Architecture](backend.md) - Go server design and implementation
- [Frontend Architecture](frontend.md) - React application structure
- [Binary Protocol](binary-protocol.md) - Wire protocol specification
- [WebSocket API](websocket-api.md) - Frontend-backend communication

### Development Resources
- [Getting Started](../guides/getting-started.md) - New developer guide
- [Development Setup](../development/DEVELOPMENT.md) - Environment configuration
- [Troubleshooting](../troubleshooting/common-issues.md) - Common problems

## Next Steps

- **New to the project?** Start with the [Getting Started Guide](../guides/getting-started.md)
- **Understanding data flow?** Read the [Complete Architecture Guide](../../CONTROL_STATION_COMPLETE_ARCHITECTURE.md)
- **Debugging issues?** Check [Troubleshooting](../troubleshooting/common-issues.md)
- **Contributing?** Review [Known Issues](issues-and-improvements.md) for areas needing help

---

*For the complete technical deep-dive, see the [Control Station Complete Architecture](../../CONTROL_STATION_COMPLETE_ARCHITECTURE.md) document.*