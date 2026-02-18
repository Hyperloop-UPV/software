# Getting Started with Hyperloop H10 Control Station

This guide will help you get up and running with the Hyperloop H10 Control Station, whether you're a developer, operator, or contributor.

## What is the H10 Control Station?

The Hyperloop H10 Control Station is a real-time monitoring and control system for Hyperloop UPV's competition pod. It provides:

- **Real-time monitoring** of pod sensors and systems
- **Control interface** for pod operations
- **Data logging** and analysis capabilities
- **Network debugging** tools for development

## Quick Setup

### Prerequisites

Before you begin, ensure you have:

- **Go 1.21+** - [Download here](https://golang.org/doc/install)
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Git** - For version control

### Platform-Specific Requirements

#### Windows
- **PowerShell 5.1+** (recommended) or Command Prompt
- **Visual C++ Build Tools** (for native modules)

#### macOS
- **Homebrew** (recommended): `brew install libpcap`
- **Xcode Command Line Tools**: `xcode-select --install`

#### Linux
- **libpcap development headers**: 
  - Ubuntu/Debian: `sudo apt install libpcap-dev`
  - CentOS/RHEL: `sudo yum install libpcap-devel`

### Installation

Choose your platform and follow the appropriate steps:

#### Windows (PowerShell - Recommended)
```powershell
# Clone the repository
git clone https://github.com/HyperloopUPV-H8/software.git
cd software

# Allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Setup dependencies
.\scripts\dev.ps1 setup

# Run all services
.\scripts\dev.ps1 all
```

#### Windows (Command Prompt)
```cmd
REM Clone the repository
git clone https://github.com/HyperloopUPV-H8/software.git
cd software

REM Setup dependencies
scripts\dev.cmd setup

REM Run all services
scripts\dev.cmd all
```

#### macOS/Linux
```bash
# Clone the repository
git clone https://github.com/HyperloopUPV-H8/software.git
cd software

# Make scripts executable
chmod +x scripts/dev.sh

# Setup dependencies
./scripts/dev.sh setup

# Run all services
./scripts/dev.sh all
```

## What Happens During Setup

The setup process will:

1. **Install frontend dependencies** for all React applications
2. **Build the common frontend library** used by all applications
3. **Download Go module dependencies** for backend services
4. **Verify all tools** are properly installed

## Running the Applications

After setup, you can access:

- **Control Station**: http://localhost:5173 - Main pod control interface
- **Ethernet View**: http://localhost:5174 - Network monitoring and debugging
- **Backend API**: http://localhost:8080 - Backend services and WebSocket

### Individual Services

You can also run services individually:

```bash
# Backend only
./scripts/dev.sh backend

# Control station only
./scripts/dev.sh control

# Ethernet view only  
./scripts/dev.sh ethernet

# Packet sender (testing tool)
./scripts/dev.sh packet
```

## Understanding the Interface

### Control Station
- **Main Dashboard**: Pod status and sensor readings
- **Control Panel**: Send commands to pod systems
- **Data Visualization**: Real-time charts and graphs
- **Camera Views**: Live video feeds from pod cameras

### Ethernet View
- **Packet Monitor**: Real-time network traffic analysis
- **Board Communication**: Monitor communication with individual boards
- **Data Tables**: Structured view of incoming sensor data
- **Debugging Tools**: Network troubleshooting utilities

## Configuration

### Backend Configuration
The main configuration file is located at `backend/cmd/config.toml`:

```toml
[network]
# Your machine's IP address (must match ADJ specifications)
backend_ip = "192.168.0.9"

[vehicle.boards]
# Enable/disable specific boards
VCU = true
PCU = true
TCU = true
# ... other boards
```

### ADJ Specifications
ADJ (JSON-based specifications) define:
- Board configurations and IDs
- Measurement definitions with units
- Packet structures and communication protocols
- Command (order) definitions

Located in: `backend/cmd/adj/boards/[BOARD_NAME]/`

## Next Steps

### For Developers
1. Read the [Development Setup](../development/DEVELOPMENT.md) guide
2. Explore the [Architecture Overview](../architecture/README.md)
3. Check out [Contributing Guidelines](../../CONTRIBUTING.md)

### For Operators
1. Review [Configuration Guide](configuration.md)
2. Learn about [Testing Procedures](testing.md)
3. Understand [Deployment Process](deployment.md)

### For Contributors
1. Read [Contributing Guidelines](../../CONTRIBUTING.md)
2. Explore existing [GitHub Issues](https://github.com/HyperloopUPV-H8/software/issues)
3. Join the development discussion

## Troubleshooting

### Common Issues

**Services won't start**
- Check that all prerequisites are installed
- Verify no other services are using the ports (5173, 5174, 8080)
- Run `./scripts/dev.sh setup` again to ensure proper installation

**Build failures**
- Ensure Go and Node.js versions meet requirements
- Check internet connectivity for downloading dependencies
- Review error messages for specific missing packages

**Permission errors (Unix)**
- Make sure scripts are executable: `chmod +x scripts/dev.sh`
- Check file permissions in the project directory

**PowerShell execution errors (Windows)**
- Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- Use "Run as Administrator" if needed

### Getting Help

- **Documentation**: Check the [troubleshooting guide](../troubleshooting/common-issues.md)
- **Issues**: Search and create [GitHub Issues](https://github.com/HyperloopUPV-H8/software/issues)
- **Community**: Join the development discussion

## Success Indicators

You'll know everything is working when:

✅ All services start without errors  
✅ Control Station loads at http://localhost:5173  
✅ Ethernet View loads at http://localhost:5174  
✅ Backend API responds at http://localhost:8080  
✅ No console errors in browser developer tools  

Welcome to the Hyperloop H10 development community! 🚄