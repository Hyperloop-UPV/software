# Menu (`menu/`)

Application menu system for the Electron application. Provides the native menu bar with keyboard shortcuts and access to application features.

## Overview

Creates native menus for the main window, backend logs, and About window. The mode selector keeps its original File menu. Menu actions such as reload, fullscreen, and DevTools operate on the window that invoked them.

## Files

- `menu.js` - Menu template definition and creation

## Menu Structure

### Control Station Menu

- **Reload** (`CmdOrCtrl+R`) - Reloads the focused window
- **Testing View**, **Competition View**, **Flashing View**, **Logging View**, **ADJ Viewer** - Switches directly to the chosen mode, stopping the previous services and starting those required by the destination. Only views included in the build are listed.
- **Return to Selector** (`CmdOrCtrl+Shift+S`) - Stops services and returns to the mode selector
- **Quit** (`CmdOrCtrl+Q`) - Quits the application

The selector retains **File > Reload / Return to Selector / Exit**, with Return to Selector disabled to prevent opening another selector.

### Edit Menu

- **Undo**, **Redo**, **Cut**, **Copy**, **Paste** - Native editing commands and their platform shortcuts. Select All is intentionally omitted.

### View Menu

- **Reload** - Reloads the invoking window (also available in Control Station)
- **Zoom In** (`CmdOrCtrl+Plus`) - Increases zoom of the focused window
- **Zoom Out** (`CmdOrCtrl+-`) - Decreases zoom of the focused window
- **Reset Zoom** (`CmdOrCtrl+0`) - Restores the focused window to 100% zoom
- **Toggle Full Screen** (`F11`) - Toggles fullscreen on the focused window
- **Development > Toggle DevTools** (`F12`) - Opens/closes Chrome DevTools for the focused window

### Tools Menu

- **Open ADJ Repository** - Opens the project's ADJ repository in the browser
- **Open App Cache Folder** - Opens Go's OS-specific cache folder for `hyperloop-control-station` (honors `XDG_CACHE_HOME` on Linux)
- **Open Settings Folder** - Opens the directory containing the active `config.toml`
- **Open Logger Folder** - Opens `<logging.logging_path>/logger`, resolving relative or empty paths against the Go backend's working directory; creates the directory on first use if needed
- **Open config.toml** - Opens the active configuration file in its default application
- **Open ADJ Folder** - Opens the Go backend's existing `adj` folder under the application cache. The backend does not support a separate configured local ADJ path.

### Window Menu

- **Show Main Window** - Restores and focuses the active mode's main window
- **Show Backend Logs** - Reopens or focuses backend logs in Testing and Competition. Keeps the latest 2000 messages, including output received while the window was closed. Reopening does not restart the backend.
- **Minimize** - Minimizes the focused window

### Help Menu

- **About Control Station** - Shows application information, the installed version, and Logging View attribution from every mode
- **Check for Updates...** - Checks for a newer release and reports the result. Updates download automatically; installation requires choosing Restart. Development builds show an informational message without contacting release servers.
- **Report an Issue...** - Opens the software repository's new-issue form; no issue is submitted automatically

The selector keeps its existing Tools and Help menus; the additional menus above apply to the other windows.

## Functions

### `createMenu({ isSelector = false } = {})`

Builds the Control Station menu, or the original File menu when `isSelector` is true. The default menu is installed during application initialization.

### `setWindowMenu(window, options)`

Assigns a window's menu on Windows/Linux. On macOS, updates the application menu when that window gains focus.

## Dependencies

- `electron` - For Menu, BrowserWindow, dialog, and app APIs

## Used By

- **`app/initialization.js`** - Sets the application-wide menu during app initialization

## Notes

- Keyboard shortcuts automatically use `Cmd` on macOS and `Ctrl` on Windows/Linux
- Menu appears in system menu bar on macOS, in window on Windows/Linux
- Menu items resolve their target window at click time (focused window), so no window reference is needed when building the menu

## See Also

- [../windows/README.md](../windows/README.md) - Window management
