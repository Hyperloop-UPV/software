# Hyperloop Control Station Build System

The project uses a unified, modular build script (`electron-app/build.mjs`) to handle building the backend (Go), packet sender (Rust), and frontends (React/Vite) for the Electron application.

## Prerequisites

- **Node.js** & **pnpm**
- **Go** (1.21+)
- **Rust/Cargo** (for Packet Sender)

## Basic Usage

Run the build script from the `electron-app` directory (or via npm scripts).

```sh
# Build EVERYTHING (Backend, Packet Sender, Frontends)
pnpm build

# OR
node build.mjs
```

## Configuration

The build configuration is defined in `electron-app/build.mjs` within the `CONFIG` object.

## Build Specific Components

You can build individual components by passing their flag.

```sh
# Build only the Backend
node build.mjs --backend

# Build only the Testing View
node build.mjs --testing-view

# Build only the Packet Sender
node build.mjs --packet-sender
```

## Platform Targeting

By default, the script builds for all defined platforms (Windows, Linux, macOS). You can limit this using flags.

```sh
# Build backend for Windows only
node build.mjs --backend --win

# Build everything for Linux
node build.mjs --linux
```

## Advanced: Overwriting Commands

The build script allows you to override configuration properties on the fly. This is useful for CI pipelines where you might want to use different build commands or flags.

**Syntax**: `--[target].[property]="value"`

### Examples

```sh
# Use a custom build command for the backend:
node build.mjs --backend --backend.commands="pnpm run build:prod --"

# Change the output directory
node build.mjs --backend --backend.output="./dist/bin"

# Pass arguments to the underlying tools (passes -v)
node build.mjs --backend -- -v
```
