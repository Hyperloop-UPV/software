# Processes (`processes/`)

Process management module for spawning and controlling external processes (backend and packet sender).

## Overview

Manages the lifecycle of external binary processes spawned by the Electron application. Handles process spawning, output logging, error handling, and graceful shutdown.

## Files

- `backend.js` - Backend process management
- `packetSender.js` - Packet sender utility process management

## Backend Process (`backend.js`)

Manages the Go backend process that handles data processing.

### Functions

- `startBackend()` - Spawns the backend process with config file path
- `stopBackend()` - Stops the backend process gracefully (SIGTERM)
- `restartBackend()` - Stops and restarts the backend process

### Behavior

- Validates binary exists before starting
- Sets working directory based on dev/production mode
- Logs stdout/stderr to logger
- Shows error dialogs on startup failures or crashes
- Passes config file path via `--config` flag

## Packet Sender Process (`packetSender.js`)

Manages the packet sender utility tool for testing.

### Functions

- `startPacketSender(args)` - Spawns packet sender with optional arguments
- `stopPacketSender()` - Stops the packet sender process
- `restartPacketSender()` - Restarts the packet sender process
- `getPacketSenderProcess()` - Returns the current process instance

### Behavior

- Validates binary exists before starting
- Logs stdout/stderr to logger
- Returns `null` if binary not found (optional tool)
- Defaults to `--help` flag when restarted

## Dependencies

- `../utils/paths.js` - For resolving binary and config paths
- `../utils/logger.js` - For process output logging
- `child_process` - For spawning processes
- `electron` - For dialog and app APIs

## Used By

- **`main.js`** - Starts backend on app ready, stops both processes on quit
- **`ipc/handlers.js`** - Restarts backend when config is saved/imported
- **`menu/menu.js`** - Provides start/stop controls for packet sender

## Notes

- Backend process is required and shows error dialogs if binary missing
- Packet sender is optional and silently fails if binary missing
- Processes are terminated with SIGTERM for graceful shutdown
- Process output is captured and logged via logger utility
- Backend working directory differs between dev and production modes

## See Also

- [../ipc/README.md](../ipc/README.md) - IPC handlers that restart backend
- [../menu/README.md](../menu/README.md) - Menu that controls packet sender
- [../utils/README.md](../utils/README.md) - Utility functions (paths, logger)
