/**
 * @module ipc
 * @description IPC (Inter-Process Communication) handlers for main process communication with renderer processes.
 * Registers handlers for:
 * - View management
 * - Configuration management
 * - Folder selection dialogs
 * - BLCU programming API proxy
 */

import { dialog, ipcMain, shell } from "electron";
import fs from "fs";
import { isAbsolute, join } from "path";
import {
  importConfig,
  readConfig,
  writeConfig,
} from "../config/configInstance.js";
import { getBackendWorkingDir, restartBackend } from "../processes/backend.js";
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

  /**
   * @event open-folder
   * @async
   * @description Opens the specified folder path in the OS file explorer.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {string} folderPath - The folder path to open.
   * @returns {Promise<void>}
   * @throws {Error} If opening the folder fails.
   */
  ipcMain.handle("open-folder", async (event, folderPath) => {
    try {
      const resolvedPath = isAbsolute(folderPath)
        ? folderPath
        : join(getBackendWorkingDir(), folderPath);
      const loggerPath = join(resolvedPath, "logger");
      await shell.openPath(fs.existsSync(loggerPath) ? loggerPath : resolvedPath);
    } catch (error) {
      logger.electron.error("Error opening folder:", error);
      throw error;
    }
  });

  // --- BLCU Programming API proxy handlers ---

  /**
   * @event blcu-select-file
   * @async
   * @description Opens a file selection dialog for firmware files.
   * @returns {Promise<string | null>} Resolves with the selected file path, or null if canceled.
   * @throws {Error} If the file selection dialog fails.
   */
  ipcMain.handle("blcu-select-file", async () => {
    try {
      const mainWindow = getMainWindow();
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Select Firmware File",
        properties: ["openFile"],
        filters: [
          { name: "Firmware", extensions: ["bin", "hex", "elf"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (result.canceled) {
        return null;
      }

      return result.filePaths[0] || null;
    } catch (error) {
      logger.electron.error("Error selecting firmware file:", error);
      throw error;
    }
  });

  /**
   * @event blcu-upload
   * @async
   * @description Proxies an upload request to the BLCU programming API.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {Object} request - The upload request payload.
   * @returns {Promise<Object>} Resolves with the API response.
   * @throws {Error} If the API request fails.
   */
  ipcMain.handle("blcu-upload", async (event, request) => {
    try {
      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return await response.json();
    } catch (error) {
      logger.electron.error("BLCU upload error:", error);
      throw error;
    }
  });

  /**
   * @event blcu-download
   * @async
   * @description Proxies a download request to the BLCU programming API.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {Object} request - The download request payload.
   * @returns {Promise<Object>} Resolves with the API response.
   * @throws {Error} If the API request fails.
   */
  ipcMain.handle("blcu-download", async (event, request) => {
    try {
      const response = await fetch("http://localhost:8000/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return await response.json();
    } catch (error) {
      logger.electron.error("BLCU download error:", error);
      throw error;
    }
  });

  /**
   * @event blcu-health
   * @async
   * @description Checks the health of the BLCU programming API.
   * @returns {Promise<Object>} Resolves with the health check response.
   * @throws {Error} If the API request fails.
   */
  ipcMain.handle("blcu-health", async () => {
    try {
      const response = await fetch("http://localhost:8000/health");

      if (!response.ok) {
        throw new Error("Health check failed");
      }

      return await response.json();
    } catch (error) {
      logger.electron.error("BLCU health check error:", error);
      throw error;
    }
  });

  /**
   * @event blcu-logs
   * @async
   * @description Retrieves logs from the BLCU programming API.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {number} tail - Number of log lines to retrieve.
   * @returns {Promise<Object>} Resolves with the logs response.
   * @throws {Error} If the API request fails.
   */
  ipcMain.handle("blcu-logs", async (event, tail = 200) => {
    try {
      const response = await fetch(`http://localhost:8000/logs?tail=${tail}`);

      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }

      return await response.json();
    } catch (error) {
      logger.electron.error("BLCU logs error:", error);
      throw error;
    }
  });
}

export { setupIpcHandlers };
