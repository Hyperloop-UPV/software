# Hyperloop Control Station - Electron App

The main Electron application that provides the control interface for the Hyperloop pod.

## Overview

Desktop application built with Electron that manages the Hyperloop pod control system. Handles backend process management, configuration, and provides multiple frontend views for competition and testing.

## Project Structure

- `src/` - Source code for Electron main process
- `renderer/` - Frontend views (control-station, ethernet-view)
- `binaries/` - Compiled backend executables
- `dist/` - Build output (generated)
- `main.js` - Electron main process entry point
- `preload.js` - Preload script for secure IPC
- `config.toml` - Application configuration
- `build.mjs` - Script used for building other projects (base for package.json scripts)

## Quick Start
~~~
# Install dependencies
npm install

# Build backend and frontends
npm run build

# Run in development mode
npm start 
~~~

## Build for production
This script creates distributables and executables.
~~~
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
~~~

## Available Scripts
~~~
- `npm start` - Run application in development mode
- `npm run build` - Build all frontend views
- `npm run dist` - Build production executable
- `npm test` - Run tests

...and many custom variations (see package.json)
~~~

## Architecture

- **Backend Process**: Go backend for data processing
- **Packet Sender**: Tool for sending test packets
- **Configuration**: TOML-based config management
- **Views**: Multiple frontend interfaces (Competition/Testing)

## Dependencies

- `electron` - Desktop application framework
- `@iarna/toml` - TOML parser for configuration
- `electron-store` - Persistent storage

## See Also

- [src/README.md](./src/README.md) - Main process source code
- [src/config/README.md](./src/config/README.md) - Configuration management
- [src/ipc/README.md](./src/ipc/README.md) - IPC handlers
- [src/processes/README.md](./src/processes/README.md) - Process management
- [package.json](./package.json) - Package.json with available scripts
