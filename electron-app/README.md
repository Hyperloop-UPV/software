# Hyperloop Control Station - Electron App

The main Electron application that provides the control interface for the Hyperloop pod.

## Overview

Desktop application built with Electron that manages the Hyperloop pod control system. Handles backend process management, BLCU programming API process management, configuration, and provides multiple frontend views for competition and testing.

## Project Structure

- `src/` - Source code for Electron main process
- `main.js` - Electron main process entry point
- `preload.js` - Preload script for secure IPC
- `build.mjs` - Script used for building other projects (base for package.json scripts)

## Development Mode - Temporary Files

When running in development mode (unpackaged), the application creates temporary files and directories in the project root:

- `config.toml` - User configuration file created on first run. This file is generated from the template at `backend/cmd/dev-config.toml` and stores your local configuration settings.  
  **Note: Uses `backend/cmd/config.toml` in production**.

- `config.toml.backup-{timestamp}` - Automatic backup files created when importing a configuration. These timestamped backups help recover previous configurations if needed.

- `binaries/` - Directory containing compiled backend and BLCU programming executables for your platform. These are generated during the build process, when running `pnpm run build`.

- `renderer/` - Directory containing built frontend views (testing-view, competition-view, flashing-view). These are generated during the build process, when running `pnpm run build`. All its content is ignored, except `mode-selector`

- `dist/` - Build output directory containing compiled and packaged application files. Generated during build and distribution processes, when running `pnpm run dist`.

**Note**: These files and directories are created in the `electron-app/` directory root during development. In production (packaged) mode:

- **Configuration and Logs**: Stored in `{UserConfigDir}/hyperloop-control-station/` (using Go's `os.UserConfigDir()`)
  - Config files and backups: `{UserConfigDir}/hyperloop-control-station/configs/`
  - Trace/log files: `{UserConfigDir}/hyperloop-control-station/configs/trace-*.json`

- **ADJ Module**: Stored in `{UserCacheDir}/hyperloop-control-station/adj/` (using Go's `os.UserCacheDir()`)

- Binaries and resources are bundled within the application package.

Typical locations:

- **Windows**:
  - UserConfigDir: `%APPDATA%\`
  - UserCacheDir: `%LOCALAPPDATA%\`
- **macOS**:
  - UserConfigDir: `~/Library/Application Support/`
  - UserCacheDir: `~/Library/Caches/`
- **Linux**:
  - UserConfigDir: `~/.config/`
  - UserCacheDir: `~/.cache/`

## Quick Start

```
# Install dependencies
pnpm install

# Build backend, BLCU programming API, and frontends
pnpm run build

# Run in development mode (you MUST run `pnpm run build` BEFORE!)
pnpm start
```

## Build for production

This script creates distributables and executables.  
**Note**: You must run `pnpm run build` for this script to work correctly.

```
pnpm run dist:win    # Windows
pnpm run dist:mac    # macOS
pnpm run dist:linux  # Linux
```

### macOS Requirements

On macOS, the backend requires the loopback address `127.0.0.9` to be configured. If you encounter a "can't assign requested address" error when starting the backend, run:

```
sudo ifconfig lo0 alias 127.0.0.9 up
```

## Available Scripts

```
- `pnpm run build` - Build all frontend views and backend
- `pnpm run build:testing` - Build only the Testing View (and copy to renderer/)
- `pnpm run build:competition` - Build only the Competition View (and copy to renderer/)
- `pnpm run build:flashing` - Build only the Flashing View (and copy to renderer/)
- `pnpm start` - Run application in development mode
- `pnpm run dist` - Build production executable
- `pnpm test` - Run tests
- `pnpm build-icons` - build icon from the icon.png file in the `/electron-app` folder
...and many custom variations (see package.json)

# Only works and makes sense after running `pnpm run dist`
- `pnpm run asar:{platform}` - Shows .asar application package content for [win, linux, mac] platforms
```

## Architecture

- **Backend Process**: Go backend for data processing
- **BLCU Programming Process**: Packaged FastAPI/TFTP API for firmware transfers
- **Configuration**: TOML-based config management
- **Views**: Multiple frontend interfaces (Competition, Testing & Flashing)

- **Mode Selector**: html5 file to chose the mode of the app: testing, competition or flashing. Placed at `renderer/mode-selector`

## Dependencies

- `electron` - Desktop application framework
- `@iarna/toml` - TOML parser for configuration
- `electron-store` - Persistent storage
- `asar` - Library for working with .ASAR files

## See Also

- [src/README.md](./src/README.md) - Main process source code
- [src/config/README.md](./src/config/README.md) - Configuration management
- [src/ipc/README.md](./src/ipc/README.md) - IPC handlers
- [src/processes/README.md](./src/processes/README.md) - Process management
- [package.json](./package.json) - Package.json with available scripts
