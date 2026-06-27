# Hyperloop Control Station Build System

The project uses a unified, modular build script (`electron-app/build.mjs`) to handle building the backend (Go), the BLCU programming API (Python/PyInstaller), and frontends (React/Vite) for the Electron application.

## Prerequisites

- **Node.js** & **pnpm**
- **Go** (1.21+)
- **Python 3** (for building the BLCU programming API executable)

## Basic Usage

Run the build script from the `electron-app` directory (or via npm scripts).

```sh
# Build EVERYTHING (Backend, BLCU API, Frontends)
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

# Build only the BLCU programming API executable
node build.mjs --blcu-programming

# Build only the Testing View
node build.mjs --testing-view

# Build only the Competition View
node build.mjs --competition-view

# Build only the Flashing View
node build.mjs --flashing-view
```

## Platform Targeting

By default, the script builds for all defined platforms (Windows, Linux, macOS). You can limit this using flags.

```sh
# Build backend for Windows only
node build.mjs --backend --win

# Build BLCU API for the current Windows host
node build.mjs --blcu-programming --win

# Build everything for Linux
node build.mjs --linux
```

The BLCU programming API is packaged with PyInstaller and cannot be cross-compiled. Build it on the same OS as the Electron release target.

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
