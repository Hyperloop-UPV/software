# Config (`config/`)

Configuration management module for the Electron application. Handles TOML-based configuration file reading, writing, and updates while preserving comments and formatting.

## Overview

Manages application configuration using TOML files. Provides a singleton ConfigManager instance that handles reading, writing, and updating configuration while preserving comments and formatting.

## Files

- `configManager.js` - ConfigManager class with TOML parsing and update utilities
- `configInstance.js` - Singleton instance and convenience functions
- `__tests__/` - Test suite for ConfigManager and utilities

## Configuration Flow

1. **Template**:
   - **Development**: `backend/cmd/dev-config.toml`
   - **Production**: `/resources/config.toml` that copied from `backend/cmd/config.toml`
3. **User Config**: Created in `{UserConfigDir}/hyperloop-control-station/configs/config.toml` on first run
4. **Updates**: User changes are written while preserving comments
5. **Backend**: Configuration is passed to the backend process on startup

## Functions

### `getConfigManager()`

Returns the singleton ConfigManager instance. Creates it on first call, copying from template if needed.

### `readConfig()`

Reads and parses the current configuration file, returning a JavaScript object.

### `writeConfig(configObject)`

Updates the configuration file with a new config object while preserving comments and formatting.

### `importConfig()`

Opens a file dialog to import a configuration file. Backs up current config before importing.

## ConfigManager Methods

- `read()` - Read and parse config as object
- `readRaw()` - Read raw TOML content
- `update(configObject)` - Update config from complete object
- `updateValue(section, key, value)` - Update a single value
- `resetToTemplate()` - Reset config to template
- `backup()` - Create timestamped backup
- `validate()` - Validate TOML structure

## Dependencies

- `../utils/paths.js` - For resolving config and template paths
- `../utils/logger.js` - For logging operations
- `@iarna/toml` - TOML parser
- `electron` - For file dialog (importConfig)

## Used By

- **`main.js`** - Initializes ConfigManager before starting backend
- **`ipc/handlers.js`** - Exposes config operations via IPC (get-config, save-config, import-config)

## Notes

- Config file is automatically created from template on first run
- Comments and formatting are preserved when updating values
- Import operation automatically backs up current config
- Config updates trigger backend restart via IPC handlers
- See `__tests__/` directory for test coverage

## See Also

- ["../../README.md"](../../README.md) - General information about the app
- [\_\_tests\_\_/README.md](__tests__/README.md) - Automatic config manager tests
- [../ipc/README.md](../ipc/README.md) - IPC handlers that expose config operations
- [../utils/README.md](../utils/README.md) - Utility functions (path resolution)
