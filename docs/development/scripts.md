# Development Scripts

This directory contains cross-platform development scripts for the Hyperloop H10 project.

## Available Scripts

### Unix/Linux/macOS
- `dev.sh` - Main development script with OS detection

### Windows
- `dev.cmd` - Windows Batch script
- `dev.ps1` - PowerShell script (recommended for Windows)

## Prerequisites

Before using any script, ensure you have the following installed:

- **Go** (1.19+)
- **Node.js** (18+)
- **npm** (comes with Node.js)

### Additional for Unix systems:
- **tmux** (for running all services simultaneously)

## Usage

### Unix/Linux/macOS

```bash
# Make script executable
chmod +x ../../scripts/dev.sh

# Run commands (from project root)
./scripts/dev.sh setup     # Install dependencies
./scripts/dev.sh backend   # Run backend server
./scripts/dev.sh ethernet  # Run ethernet-view
./scripts/dev.sh control   # Run control-station
./scripts/dev.sh packet    # Run packet-sender
./scripts/dev.sh all       # Run all services (requires tmux)
./scripts/dev.sh test      # Run tests
./scripts/dev.sh build     # Build all components
```

### Windows Command Prompt

```cmd
REM Run commands
scripts\dev.cmd setup     REM Install dependencies
scripts\dev.cmd backend   REM Run backend server
scripts\dev.cmd ethernet  REM Run ethernet-view
scripts\dev.cmd control   REM Run control-station
scripts\dev.cmd packet    REM Run packet-sender
scripts\dev.cmd all       REM Run all services in separate windows
scripts\dev.cmd test      REM Run tests
scripts\dev.cmd build     REM Build all components
```

### Windows PowerShell

```powershell
# You may need to allow script execution first:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run commands
.\scripts\dev.ps1 setup     # Install dependencies
.\scripts\dev.ps1 backend   # Run backend server
.\scripts\dev.ps1 ethernet  # Run ethernet-view
.\scripts\dev.ps1 control   # Run control-station
.\scripts\dev.ps1 packet    # Run packet-sender
.\scripts\dev.ps1 all       # Run all services in separate windows
.\scripts\dev.ps1 test      # Run tests
.\scripts\dev.ps1 build     # Build all components
```

## Commands Explained

### `setup`
Installs all project dependencies:
- Installs npm packages for `common-front`, `ethernet-view`, and `control-station`
- Downloads Go module dependencies for `backend` and `packet-sender`
- Builds the `common-front` library

### `backend`
Starts the Go backend server in development mode.

### `ethernet`
Starts the ethernet-view frontend development server (typically on port 5174).

### `control`
Starts the control-station frontend development server (typically on port 5173).

### `packet`
Starts the packet-sender utility.

### `all`
Runs all services simultaneously:
- **Unix/Linux/macOS**: Uses tmux to create a session with multiple windows
- **Windows**: Opens each service in a separate command/PowerShell window

### `test`
Runs all project tests (currently backend Go tests).

### `build`
Builds all project components for production.

## Platform-Specific Notes

### Windows
- The `all` command opens separate windows for each service instead of using tmux
- PowerShell script (`dev.ps1`) is recommended over batch script (`dev.cmd`) for better functionality
- If you encounter execution policy issues with PowerShell, run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Unix/Linux/macOS
- The `all` command requires tmux to be installed
- If tmux is not available, run services individually in separate terminals
- The script automatically detects the operating system

## Troubleshooting

### "Command not found" errors
Ensure Go, Node.js, and npm are installed and available in your PATH.

### tmux not found (Unix systems)
Install tmux or run services individually:
```bash
# Install tmux on Ubuntu/Debian
sudo apt install tmux

# Install tmux on macOS with Homebrew
brew install tmux

# Or run services individually in separate terminals
./scripts/dev.sh backend   # Terminal 1
./scripts/dev.sh ethernet  # Terminal 2
./scripts/dev.sh control   # Terminal 3
./scripts/dev.sh packet    # Terminal 4
```

### PowerShell execution policy (Windows)
If you get an execution policy error, run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Port conflicts
If you encounter port conflicts, check that no other services are running on the default ports:
- Backend: 8080 (configurable)
- Ethernet-view: 5174
- Control-station: 5173