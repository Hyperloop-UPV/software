# Processes (`processes/`)

Process management module for spawning and controlling external processes (backend and BLCU programming service).

## Overview

Manages the lifecycle of external binary processes spawned by the Electron application. Handles process spawning, output logging, error handling, and graceful shutdown.

## Files

- `backend.js` - Go backend process management
- `blcuProgramming.js` - BLCU programming (Python/FastAPI) process management

---

## Backend Process (`backend.js`)

Manages the Go backend binary that handles data ingestion and pod communication.

### Functions

- `startBackend(logWindow)` - Spawns the backend binary, piping stdout/stderr to the log window
- `stopBackend()` - Stops the backend process gracefully (SIGTERM)
- `restartBackend()` - Stops and restarts the backend process

### Behavior

- Validates the binary exists before starting
- Sets working directory based on dev/production mode
- Streams stdout/stderr to the log window via IPC
- Shows error dialogs on startup failures or crashes
- Passes the config file path via `--config` flag

---

## BLCU Programming Process (`blcuProgramming.js`)

Manages the PyInstaller-compiled BLCU programming binary that serves the FastAPI HTTP server for the Flashing View.

### Functions

- `startBlcuProgramming()` - Spawns the BLCU binary and resolves when the process is running
- `stopBlcuProgramming()` - Stops the BLCU process gracefully

### Behavior

- Resolves the platform-specific binary name from `electron-app/binaries/`
- Sets `BLCU_API_HOST` and `BLCU_API_PORT` environment variables (defaults: `127.0.0.1:8069`)
- Logs process stdout/stderr via `logger.process()`
- Exits the Electron app if the binary cannot be found

---

## Dependencies

- `../utils/paths.js` - Binary path resolution
- `../utils/logger.js` - Process output logging
- `child_process` - Process spawning
- `electron` - Dialog and app APIs

## Used By

- **`app/modeSelector.js`** - Starts the appropriate process for the selected mode (backend for testing/competition, BLCU for flashing)
- **`main.js`** - Stops all processes on app quit

## See Also

- [../ipc/README.md](../ipc/README.md) - IPC handlers
- [../utils/README.md](../utils/README.md) - Utility functions (paths, logger)
- [../windows/README.md](../windows/README.md) - Window management
