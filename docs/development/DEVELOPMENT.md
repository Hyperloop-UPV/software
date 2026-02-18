# Development Setup

This guide provides multiple ways to set up your development environment for the Hyperloop H10 project.

## Quick Start (Recommended)

### Option 1: Cross-Platform Development Scripts

We provide multiple scripts to work across different platforms:

#### Unix/Linux/macOS (Bash)
```bash
# Make script executable
chmod +x scripts/dev.sh

# Install dependencies and setup
./scripts/dev.sh setup

# Run individual services
./scripts/dev.sh backend      # Run backend server
./scripts/dev.sh ethernet     # Run ethernet-view
./scripts/dev.sh control      # Run control-station
./scripts/dev.sh packet       # Run packet-sender

# Run all services in tmux
./scripts/dev.sh all
```

#### Windows (PowerShell - Recommended)
```powershell
# You may need to allow script execution first:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install dependencies and setup
.\scripts\dev.ps1 setup

# Run individual services
.\scripts\dev.ps1 backend     # Run backend server
.\scripts\dev.ps1 ethernet    # Run ethernet-view
.\scripts\dev.ps1 control     # Run control-station
.\scripts\dev.ps1 packet      # Run packet-sender

# Run all services in separate windows
.\scripts\dev.ps1 all
```

#### Windows (Command Prompt)
```cmd
REM Install dependencies and setup
scripts\dev.cmd setup

REM Run individual services
scripts\dev.cmd backend   REM Run backend server
scripts\dev.cmd ethernet  REM Run ethernet-view
scripts\dev.cmd control   REM Run control-station
scripts\dev.cmd packet    REM Run packet-sender

REM Run all services in separate windows
scripts\dev.cmd all
```

#### Universal Script (Git Bash/WSL/MSYS2)
For Windows users with Git Bash, WSL, or MSYS2:
```bash
# Enhanced cross-platform script with better Windows support
chmod +x scripts/dev-unified.sh
./scripts/dev-unified.sh setup
./scripts/dev-unified.sh all
```

### Option 2: Using Docker Compose

```bash
# Run all services
docker-compose -f docker-compose.dev.yml up

# Run specific service
docker-compose -f docker-compose.dev.yml up backend
```

### Option 3: Manual Setup

```bash
# 1. Build common-front first (required)
cd common-front
npm install
npm run build

# 2. Install frontend dependencies
cd ../ethernet-view
npm install

cd ../control-station
npm install

# 3. Run services
cd backend/cmd && go run .              # Terminal 1
cd ethernet-view && npm run dev         # Terminal 2
cd control-station && npm run dev       # Terminal 3
cd packet-sender && go run .            # Terminal 4
```

### Option 4: Using Nix (Advanced)

For developers who prefer Nix for reproducible environments:

```bash
# Pure shell with Fish
nix-shell

# Or with your existing shell config
nix-shell -A impure
```

This provides a fully reproducible development environment with all dependencies.

## Platform-Specific Notes

### Windows
- **PowerShell Script** (`dev.ps1`) is recommended over Command Prompt (`dev.cmd`) for better functionality
- If you encounter execution policy issues: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- The `all` command opens each service in separate windows instead of using tmux
- For Unix-like experience on Windows, use **Git Bash**, **WSL**, or **MSYS2** with the unified script

### Unix/Linux/macOS
- The `all` command uses **tmux** for session management (install with your package manager)
- If tmux is unavailable, services run in parallel background processes
- Use `Ctrl+C` to stop all services when running in parallel mode

### Git Bash/WSL/MSYS2
- Use the `dev-unified.sh` script for enhanced Windows compatibility
- Automatically detects WSL and adjusts behavior accordingly
- Provides better path handling for Windows environments

## Prerequisites

- Go 1.21+
- Node.js 18+
- npm
- libpcap (for packet capture)
  - macOS: `brew install libpcap`
  - Ubuntu: `sudo apt-get install libpcap-dev`
  - Windows: Install WinPcap or Npcap

## Service Ports

- Backend: 8080
- Control Station: 5173
- Ethernet View: 5174

## Common Tasks

### Run Tests
```bash
./scripts/dev.sh test
# or manually:
cd backend && go test -v ./...
```

### Build All Components
```bash
make all
```

### Update Dependencies
```bash
# Go dependencies
cd backend && go mod tidy

# Node dependencies
cd common-front && npm update
cd control-station && npm update
cd ethernet-view && npm update
```

## Troubleshooting

1. **Permission denied on macOS/Linux for packet capture**:
   ```bash
   sudo setcap cap_net_raw+ep $(which go)
   ```

2. **Common-front not found errors**:
   Make sure to build common-front first:
   ```bash
   cd common-front && npm install && npm run build
   ```

3. **Port already in use**:
   Check and kill processes using the ports:
   ```bash
   lsof -i :8080  # backend
   lsof -i :5173  # control-station
   lsof -i :5174  # ethernet-view
   ```