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

## Cloud Logs

Cloud Logs is a desktop capability shared by Logging View and Testing View. The
renderer calls the narrow `window.electronAPI.cloudLogs` interface exposed from
`preload.js`; it does not access the filesystem, ZIP library, credentials, or
remote API directly. The IPC handlers in `src/cloudLogs/handlers.js` validate
that requests come from the local Logging or Testing window and keep local paths
inside the Electron main process.

The local folder format is `<logging_path>/logger/<app-launch>/<recording>/`.
Cloud uploads operate on one recording at a time. All regular session files
(configuration, CSVs, and metadata) are packaged and preserved in the recording
ZIP, including the root `logger_settings.json` and all current or future telemetry
subfolders. Launcher traces, symlinks, and directory traversal paths are excluded.
The date attached to a cloud record comes from the recording's
`logger_settings.json`, not from the time it was uploaded. Users must confirm
that recording has stopped; Electron checks that its files did not change while
it compressed the ZIP and reports compression progress to the requesting view.

Downloaded archives are checked and extracted into
`<logging_path>/logger/cloud-logs/<sanitized fileName or title>-<hh-mm-ss>/`. Extraction uses a staging
directory and rejects unsafe paths, links, duplicate entries, unsupported files,
encrypted ZIPs, and archives over the configured file and byte limits. Logging
View opens a downloaded recording through the same loader it uses for local
folders, so analysis works offline after download. `cloud-logs/` is created on
first use, even when the Go backend is not running.

The shared typed renderer contract is exported as `CloudLogsAPI` from
`@hyperloopupv/frontend-kit/core`. Testing View already has that type on its
Electron bridge, so it can call the same service without implementing another
network or filesystem client. The React implementation currently lives in
`frontend/logging-view/src/components/cloudLogs/CloudLogsDialog.tsx`.

Credentials are entered in the Cloud Logs dialog and managed by Electron in
`src/cloudLogs/credentials.js`. The user name and encrypted key are stored in
`<Electron userData>/cloud-logs.json` when OS secure storage is available. If
secure storage is unavailable, Electron keeps the key in memory until exit. The
key is never sent back to the renderer; the renderer only receives the user,
whether a key is configured, and whether storage is persistent.

### Cloud Logs API Integration

The remote HTTP adapter in `src/cloudLogs/client.js` is fully connected to the
Cloud Logs API (`https://cloud-logs.hyperloopupv.com/api/v1`, configurable via
`CLOUD_LOGS_API_URL` or `config.toml`) and supports direct-to-storage uploads
and downloads:

- **Catalog & Tags**: Lists paginated recordings (`listLogs`) and retrieves tag
  suggestions for autocomplete (`autocompleteTags`).
- **Direct-to-Storage Uploads**: Uploads use a two-phase protocol where session
  metadata is registered with the API (`POST /logs/initiate`) and the ZIP archive
  is streamed directly to Google Drive via a pre-authenticated resumable upload URL,
  followed by confirmation (`POST /logs/{id}/complete`).
- **Direct-to-Storage Downloads**: Downloads stream the ZIP archive directly from
  storage to disk with size limit enforcement and error sanitization.

All requests are authenticated via `Bearer` token or `X-API-Key`. Detailed API
specifications, data mappings, and error formats are documented in
`src/cloudLogs/README.md`.

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
