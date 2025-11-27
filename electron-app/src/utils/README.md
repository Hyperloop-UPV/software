# Utils (`utils/`)

Utility functions for path resolution, logging, and terminal output formatting.

## Overview

Provides shared utility functions used throughout the Electron application for path management, logging, and colored console output.

## Files

- `paths.js` - Path resolution utilities
- `logger.js` - Logging utility with colored output
- `colors.js` - ANSI color code constants

## Path Utilities (`paths.js`)

Resolves application paths that differ between development and production modes.

### Functions

- `getAppPath()` - Returns the application root directory path
- `getBinaryPath(name)` - Returns path to a binary executable (platform/arch aware)
- `getUserConfigPath()` - Returns path to user configuration file
- `getTemplatePath()` - Returns path to configuration template file

### Behavior

- Automatically detects development vs production mode
- Handles platform-specific paths (Windows, macOS, Linux)
- Maps Node.js platform/arch to Go naming conventions
- Uses `process.resourcesPath` in production, local paths in development

## Logger (`logger.js`)

Provides structured logging with colored output and context-specific loggers.

### Features

- Colored console output using ANSI codes
- Context-specific loggers (electron, backend, config, packetSender)
- Multiple log levels (info, success, warning, error, debug)
- Special methods (header, step, path) for formatted output

### Usage

```
import { logger } from './utils/logger.js';

logger.info('General message');
logger.backend.info('Backend message');
logger.config.error('Config error');
```

## Colors (`colors.js`)

ANSI color code constants for terminal output formatting.

### Available Colors

- Basic: red, green, yellow, blue, magenta, cyan, white, gray
- Bright variants: brightRed, brightGreen, brightYellow, etc.
- Modifiers: reset, bright, dim

## Dependencies

- `electron` - For app path resolution and user data paths
- `path` - For path manipulation
- `url` - For ES module path resolution

## Used By

- **`config/configInstance.js`** - Uses path utilities and logger
- **`processes/backend.js`** - Uses path utilities and logger
- **`processes/packetSender.js`** - Uses path utilities and logger
- **`windows/mainWindow.js`** - Uses path utilities
- **`ipc/handlers.js`** - Uses logger
- **`menu/menu.js`** - Uses path utilities
- **`config/configManager.js`** - Uses logger

## Notes

- Path resolution automatically adapts to development/production environments
- Logger provides consistent colored output across all modules
- Binary paths include platform and architecture in filename
- Config paths differ between dev (local) and production (userData)

## See Also

- [../config/README.md](../config/README.md) - Uses path and logger utilities
- [../processes/README.md](../processes/README.md) - Uses path and logger utilities
