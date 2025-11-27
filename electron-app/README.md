# Hyperloop Control Station - Electron App

The main Electron application that provides the control interface for the Hyperloop pod.

## Project Structure

`electron-app/
├── src/ # Source code for the Electron main process
├── renderer/ # Frontend views (control-station, ethernet-view)
├── binaries/ # Compiled backend executables
├── dist/ # Build output (generated)
├── main.js # Electron main process entry point
├── preload.js # Preload script for secure IPC
├── package.json # Project dependencies and scripts
└── config.toml # Application configuration`

## Quick Start

# Install dependencies

npm install

# Run in development mode

npm start

# Build for production

npm run dist:win # Windows
npm run dist:mac # macOS
npm run dist:linux # Linux## Available Scripts

- `npm start` - Run the application in development mode
- `npm run build` - Build all frontend views
- `npm run dist` - Build production executable
- `npm test` - Run tests

## Architecture

This Electron app manages:

- **Backend Process**: Go backend for data processing
- **Packet Sender**: Tool for sending test packets
- **Configuration**: TOML-based config management
- **Views**: Multiple frontend interfaces (Competition/Testing)

For detailed information about specific components, see the README.md in each subdirectory.
