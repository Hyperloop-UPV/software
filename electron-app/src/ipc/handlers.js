/**
 * @module ipc
 * @description IPC (Inter-Process Communication) handlers for main process communication with renderer processes.
 * Registers handlers for:
 * - View management
 * - Configuration management
 * - Folder selection dialogs
 */

import { app, dialog, ipcMain, shell } from "electron";
import { readFile } from "fs/promises";
import fs from "fs";
import { isAbsolute, join } from "path";
import {
  importConfig,
  readConfig,
  writeConfig,
} from "../config/configInstance.js";
import {
  getBackendWorkingDir,
  restartBackend,
} from "../processes/backend.js";
import { logger } from "../utils/logger.js";
import { getAppPath } from "../utils/paths.js";
import {
  getCurrentView,
  getMainWindow,
  loadView,
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
   * @event restart-backend
   * @async
   * @description Stops the backend process, restarts it, and reloads the renderer once ready.
   */
  ipcMain.handle("restart-backend", async () => {
    try {
      await restartBackend();
    } catch (error) {
      logger.electron.error("Failed to restart backend:", error);
      dialog.showErrorBox("Restart Failed", `Could not restart backend:\n\n${error.message}`);
    } finally {
      loadView("testing-view");
    }
  });

  ipcMain.handle("get-app-version", () => app.getVersion());

  ipcMain.handle("get-available-views", () => {
    const ALL_VIEWS = [
      { mode: "testing", label: "Testing View" },
      { mode: "competition", label: "Competition View" },
      { mode: "flashing", label: "Flashing View" },
    ];
    const rendererDir = join(getAppPath(), "renderer");
    return ALL_VIEWS.filter(({ mode }) =>
      fs.existsSync(join(rendererDir, `${mode}-view`))
    );
  });

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
      app.emit("return-to-selector");
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
      app.emit("return-to-selector");
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
      await shell.openPath(
        fs.existsSync(loggerPath) ? loggerPath : resolvedPath,
      );
    } catch (error) {
      logger.electron.error("Error opening folder:", error);
      throw error;
    }
  });

  // BLCU — only the file picker runs through IPC; all API calls go directly
  // from the renderer to http://localhost:8000.

  ipcMain.handle("blcu-select-file", async () => {
    try {
      const mainWindow = getMainWindow();
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Select Firmware File",
        properties: ["openFile"],
        filters: [{ name: "Firmware", extensions: ["bin", "hex", "elf"] }],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    } catch (error) {
      logger.electron.error("Error opening firmware file dialog:", error);
      return null;
    }
  });

  ipcMain.handle("blcu-read-file", async (_event, filePath) => {
    return await readFile(filePath);
  });
}

export { setupIpcHandlers };
