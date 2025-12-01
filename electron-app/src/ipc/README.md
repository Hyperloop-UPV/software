# IPC (`ipc/`)

Inter-Process Communication handlers for secure communication between the Electron main process and renderer (frontend) processes.

## Overview

Sets up IPC channels that allow the renderer process to safely use functions defined in main. All handlers use Electron's secure `ipcMain.handle()` API with context isolation enabled.

## Files

- `handlers.js` - IPC handler registration and implementation

## IPC Channels

### `get-current-view`

Returns the name of the currently active view (`"control-station"` or `"ethernet-view"`).

### `switch-view`

Switches the main window to a different view. Takes view name as parameter.

### `save-config`

Saves the application configuration to disk and automatically restarts the backend process.

### `get-config`

Reads and returns the current application configuration object.

### `import-config`

Opens a file dialog to import a configuration file and automatically restarts the backend process.

### `select-folder`

Opens a native folder selection dialog. Returns the selected folder path or `null` if cancelled.

## Functions

### `setupIpcHandlers()`

Registers all IPC handlers with the main process. Must be called before the app is ready.

## Dependencies

- `../config/configInstance.js` - Configuration read/write operations
- `../windows/mainWindow.js` - Window management and view switching
- `../processes/backend.js` - Backend process restart functionality
- `../utils/logger.js` - Error logging
- `electron` - IPC and dialog APIs

## Used By

- **`main.js`** - Sets up IPC handlers during application initialization

## Notes

- All handlers use try-catch blocks for error handling
- Errors are logged and re-thrown to the renderer
- Renderer accesses these via `window.electronAPI` exposed by `preload.js`
- Configuration changes automatically trigger backend restart

## See Also

- [`../../preload.js`](../../preload.js) - Preload script that exposes IPC to renderer
- [../config/README.md](../config/README.md) - Configuration management
- [../windows/README.md](../windows/README.md) - Window management
- [../processes/README.md](../processes/README.md) - Process management
