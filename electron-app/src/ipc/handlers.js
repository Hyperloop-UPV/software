/**
 * @module ipc
 * @description IPC (Inter-Process Communication) handlers for main process communication with renderer processes.
 * Registers handlers for:
 * - View management
 * - Configuration management
 * - Folder selection dialogs
 */

import { dialog, ipcMain } from "electron";
import {
  importConfig,
  readConfig,
  writeConfig,
} from "../config/configInstance.js";
import { restartBackend } from "../processes/backend.js";
import { logger } from "../utils/logger.js";
import {
  getCurrentView,
  getMainWindow,
  loadView,
  reloadWindow,
} from "../windows/mainWindow.js";

/**
 * Initializes all IPC handlers for communication between main and renderer processes.
 * Should be called once during main process initialization.
 * @returns {void}
 * @example
 * import { setupIpcHandlers } from './ipc.js';
 * setupIpcHandlers();
 */
function setupIpcHandlers() {
  /**
   * @event get-current-view
   * @description Returns the identifier of the currently loaded view.
   * @returns {string} The current view name (e.g., "ethernet-view", "control-station").
   */
  ipcMain.handle("get-current-view", () => getCurrentView());

  /**
   * @event switch-view
   * @description Switches the main window to the specified view.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {string} view - The name of the view to switch to (e.g., "ethernet-view", "control-station").
   * @returns {string} The view name that was loaded.
   */
  ipcMain.handle("switch-view", (event, view) => {
    loadView(view);
    return view;
  });

  /**
   * @event save-config
   * @async
   * @description Saves the provided configuration object to disk and restarts the backend process.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {Object} config - The configuration object to save.
   * @returns {Promise<boolean>} Resolves true if the configuration was saved successfully.
   * @throws {Error} If saving the configuration fails.
   */
  ipcMain.handle("save-config", async (event, config) => {
    try {
      await writeConfig(config);
      await restartBackend();

      reloadWindow();

      return true;
    } catch (error) {
      logger.electron.error("Error saving config:", error);
      throw error;
    }
  });

  /**
   * @event get-config
   * @async
   * @description Reads and returns the current configuration from disk.
   * @returns {Promise<Object>} Resolves with the configuration object.
   * @throws {Error} If reading the configuration fails.
   */
  ipcMain.handle("get-config", async () => {
    try {
      return await readConfig();
    } catch (error) {
      logger.electron.error("Error reading config:", error);
      throw error;
    }
  });

  /**
   * @event import-config
   * @async
   * @description Imports a configuration file selected by the user and restarts the backend.
   * Opens a native file dialog to select a config file.
   * @returns {Promise<boolean>} Resolves true if the configuration was imported successfully.
   * @throws {Error} If importing the configuration fails.
   */
  ipcMain.handle("import-config", async () => {
    try {
      await importConfig();
      await restartBackend();

      reloadWindow();

      return true;
    } catch (error) {
      logger.electron.error("Error importing config:", error);
      throw error;
    }
  });

  /**
   * @event select-folder
   * @async
   * @description Opens a folder selection dialog and returns the selected folder path.
   * @returns {Promise<string | null>} Resolves with the selected folder path, or null if canceled or no path selected.
   * @throws {Error} If the folder selection dialog fails.
   */
  ipcMain.handle("select-folder", async () => {
    try {
      const mainWindow = getMainWindow();
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Select Logging Folder",
        properties: ["openDirectory"],
      });

      if (result.canceled) {
        return null;
      }

      return result.filePaths[0] || null;
    } catch (error) {
      logger.electron.error("Error selecting folder:", error);
      throw error;
    }
  });
}

export { setupIpcHandlers };
