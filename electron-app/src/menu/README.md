# Menu (`menu/`)

Application menu system for the Electron application. Provides the native menu bar with keyboard shortcuts and access to application features.

## Overview

Creates and manages the native application menu bar with view switching, window controls, developer tools, and utility applications.

## Files

- `menu.js` - Menu template definition and creation

## Menu Structure

### File Menu

- **Reload** (`CmdOrCtrl+R`) - Reloads the current window
- **Exit** (`CmdOrCtrl+Q`) - Quits the application

### View Menu

- **Control Station** (`CmdOrCtrl+1`) - Switches to Competition View
- **Ethernet View** (`CmdOrCtrl+2`) - Switches to Testing View
- **Toggle DevTools** (`F12`) - Opens/closes Chrome DevTools

### Tools Menu (Developing)

- **Start Packet Sender** - Launches packet sender utility (validates binary exists)
- **Stop Packet Sender** - Stops the running packet sender process

### Help Menu

- **About** - Displays application information dialog

## Functions

### `createMenu(mainWindow)`

Creates and sets the application menu bar. Takes the main window instance as parameter.

## Dependencies

- `../processes/packetSender.js` - For starting/stopping packet sender
- `../utils/paths.js` - For resolving binary paths
- `electron` - For Menu, dialog, and app APIs

## Used By

- **`windows/mainWindow.js`** - Creates the menu when initializing the main window

## Notes

- Keyboard shortcuts automatically use `Cmd` on macOS and `Ctrl` on Windows/Linux
- Menu appears in system menu bar on macOS, in window on Windows/Linux
- Packet sender binary existence is validated before starting
- View switching requires `loadView` to be imported from windows module

## See Also

- [../windows/README.md](../windows/README.md) - Window management (used for view switching)
- [../processes/README.md](../processes/README.md) - Process management (packet sender)
- [../utils/README.md](../utils/README.md) - Utility functions (path resolution)
