# Windows (`windows/`)

Window management module for the Electron application. Handles creation, configuration, and view switching for the main application window.

## Overview

Manages the primary Electron `BrowserWindow` instance and provides functionality for switching between different application views (Competition View and Testing View).

## Files

- `mainWindow.js` - Main window creation and management

## Window Configuration

- **Default Size**: 1920x1080 pixels
- **Minimum Size**: 1280x720 pixels
- **Title**: "Hyperloop Control Station"
- **Background Color**: `#1a1a1a` (dark theme)
- **Security**: Context isolation enabled, node integration disabled

## Available Views

- **Ethernet View** (default) - Testing interface, loads from `renderer/ethernet-view/index.html`
- **Control Station** - Competition interface, loads from `renderer/control-station/index.html`

## Functions

### `createWindow()`

Creates and initializes the main application window. Loads default view, sets up menu, and opens DevTools in development mode.

### `loadView(view)`

Switches the main window to display a different view. Updates window title and validates view file exists.

### `getCurrentView()`

Returns the name of the currently active view (`"control-station"` or `"ethernet-view"`).

### `getMainWindow()`

Returns the Electron `BrowserWindow` instance for the main window, or `null` if not created yet.

## Dependencies

- `../menu/menu.js` - For creating application menu
- `../utils/paths.js` - For resolving application paths
- `electron` - For BrowserWindow, app, and dialog APIs

## Used By

- **`main.js`** - Creates the window when the app is ready
- **`menu/menu.js`** - Uses view switching functionality
- **`ipc/handlers.js`** - Uses view switching and window access functions

## Notes

- Window automatically opens DevTools in development mode
- View file existence is validated before loading
- Error dialogs are shown if view files are missing
- Window reference is set to `null` when closed

## See Also

- [../menu/README.md](../menu/README.md) - Menu system that uses view switching
- [../ipc/README.md](../ipc/README.md) - IPC handlers that use window functions
- [../../main.js](../../main.js) - Application entry point that creates the window
