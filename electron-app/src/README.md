# Source Code (`src/`)

Main source directory for the Electron main process logic.

## Overview

Contains all modules for the Electron main process, which runs in a Node.js environment and handles system-level operations, process management, file system access, and IPC communication with renderer processes.

## Directory Structure

- `config/` - Configuration management (TOML)
- `ipc/` - IPC handlers for renderer communication
- `menu/` - Application menu definition
- `processes/` - Backend and packet sender process management
- `utils/` - Utility functions (paths, logging, colors)
- `windows/` - Window creation and management

## Key Concepts

- **Main Process**: Code runs in Electron's main process (Node.js environment)
- **Modular Architecture**: All modules use ES6 imports/exports, except preload.js and it can't be changed due to Electron's limitations
- **System Operations**: Handles process spawning, file system access, and IPC

## Dependencies

- `electron` - Desktop application framework
- `@iarna/toml` - TOML parser for configuration

## See Also

- [config/README.md](./config/README.md) - Configuration management
- [ipc/README.md](./ipc/README.md) - IPC handlers
- [menu/README.md](./menu/README.md) - Application menu
- [processes/README.md](./processes/README.md) - Process management
- [utils/README.md](./utils/README.md) - Utility functions
- [windows/README.md](./windows/README.md) - Window management
