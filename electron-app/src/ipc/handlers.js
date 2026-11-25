/**
 * @module ipc
 * @description IPC (Inter-Process Communication) handlers for main process communication with renderer processes.
 * Registers handlers for:
 * - View management
 * - Configuration management
 * - Folder selection dialogs
 * - Session file management
 * - Cloud logs integration
 */

import { app, dialog, ipcMain, shell } from "electron";
import { execFile } from "child_process";
import { readFile, readdir, stat } from "fs/promises";
import fs from "fs";
import { basename, isAbsolute, join, resolve, sep } from "path";
import { promisify } from "util";
import {
  importConfig,
  readConfig,
  writeConfig,
} from "../config/configInstance.js";
import { getBackendWorkingDir, restartBackend } from "../processes/backend.js";
import { logger } from "../utils/logger.js";
import { getAppPath } from "../utils/paths.js";
import { setupCloudLogsHandlers } from "../cloudLogs/handlers.js";
import { getLogsRoot } from "../cloudLogs/sessions.js";
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
  setupCloudLogsHandlers();

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
      dialog.showErrorBox(
        "Restart Failed",
        `Could not restart backend:\n\n${error.message}`,
      );
    } finally {
      loadView("testing-view");
    }
  });

  /**
   * @event get-app-version
   * @description Returns the application version string from package metadata.
   * @returns {string} The application version.
   */
  ipcMain.handle("get-app-version", () => app.getVersion());

  /**
   * @event setup-kernel
   * @async
   * @description Configures kernel parameters needed by the backend
   * (disables the TCP invalid-packet rate limit and lowers the TCP
   * retransmission limit). Linux only; on other platforms it shows a
   * warning dialog.
   * @returns {Promise<{success: boolean, message: string}>}
   */
  ipcMain.handle("setup-kernel", async () => {
    if (process.platform !== "linux") {
      const message = "Kernel setup is only available on Linux";
      dialog.showMessageBox({
        type: "warning",
        title: "Not available",
        message,
      });
      return { success: false, message };
    }

    try {
      const { stdout } = await promisify(execFile)("pkexec", [
        "sysctl",
        "-w",
        "net.ipv4.tcp_invalid_ratelimit=0",
        "net.ipv4.tcp_retries2=3",
      ]);
      logger.electron.info(`Kernel setup completed: ${stdout.trim()}`);
      return { success: true, message: "Kernel set up successfully" };
    } catch (error) {
      logger.electron.error("Kernel setup failed:", error);
      return { success: false, message: error.stderr?.trim() || error.message };
    }
  });

  /**
   * @event get-available-views
   * @description Returns the list of views available in the current build.
   * @returns {Array<{mode: string, label: string}>} Available views list.
   */
  ipcMain.handle("get-available-views", () => {
    const ALL_VIEWS = [
      { mode: "testing", label: "Testing View" },
      { mode: "competition", label: "Competition View" },
      { mode: "flashing", label: "Flashing View" },
      { mode: "logging", label: "Logging View" },
      { mode: "adj", label: "ADJ Viewer" },
    ];
    const rendererDir = join(getAppPath(), "renderer");
    return ALL_VIEWS.filter(({ mode }) =>
      fs.existsSync(join(rendererDir, `${mode}-view`)),
    );
  });

  /**
   * @event switch-view
   * @description Switches to the specified view.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {string} view - The name of the view to switch to.
   * @param {Record<string, string>} [query] - Optional query params passed through to the
   *   loaded view's URL (e.g. `{ commit: hash }` so adj-view can auto-load a commit).
   * @returns {string} The view name that was loaded.
   */
  ipcMain.handle("switch-view", (event, view, query) => {
    loadView(view, query ? { query } : undefined);
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
        defaultPath: await getLogsRoot(),
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

  // Logging View session folders. The renderer's folder picker only yields
  // browser File objects, so reopening a recent session from its path needs
  // the main process to list and read it.

  /**
   * Restricts session file IPC access strictly to the main window webContents.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @throws {Error} If the sender is not the main window.
   * @returns {void}
   */
  const assertSessionSender = (event) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      throw new Error("Session file IPC is restricted to the main window");
    }
  };

  // A recording is identified by logger_settings.json. Walk its contents up to 10,000 files
  // and depth 8, matching cloud-logs session limits, so future logger subfolders can be read.
  const SESSION_FILE_LIMIT = 10000;
  const MAX_SESSION_DEPTH = 8;

  /**
   * Recursively collects file entries within a session directory up to SESSION_FILE_LIMIT and MAX_SESSION_DEPTH.
   * @param {string} dir - The session root directory path.
   * @returns {Promise<string[]>} Array of slash-separated relative file paths.
   */
  const listSessionEntries = async (dir) => {
    const entries = [];
    const walk = async (relative = "", depth = 0) => {
      if (depth > MAX_SESSION_DEPTH) return;
      const children = await readdir(join(dir, relative), {
        withFileTypes: true,
      });
      for (const child of children) {
        if (child.isSymbolicLink()) continue;
        const name = relative ? join(relative, child.name) : child.name;
        if (child.isDirectory()) await walk(name, depth + 1);
        else if (child.isFile() && name !== "cloud-log.json")
          entries.push(name.split(sep).join("/"));
        if (entries.length >= SESSION_FILE_LIMIT) return;
      }
    };
    try {
      await walk();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return entries;
  };

  /**
   * @event list-session-files
   * @async
   * @description Lists the files a logging session folder is made of.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {string} dir - Absolute path of the session folder.
   * @returns {Promise<{folderName: string, entries: string[]}>} Folder basename
   * plus slash-separated paths relative to it.
   * @throws {Error} If the path is not an absolute existing directory.
   */
  ipcMain.handle("list-session-files", async (event, dir) => {
    assertSessionSender(event);
    if (typeof dir !== "string" || !isAbsolute(dir)) {
      throw new Error("A session folder must be given as an absolute path");
    }
    const stats = await stat(dir);
    if (!stats.isDirectory()) {
      throw new Error(`Not a folder: ${dir}`);
    }
    let folderName = basename(dir) || "Session";
    try {
      // If cloud-log.json is present, use its title or archive filename instead of the raw directory name.
      const info = JSON.parse(
        await readFile(join(dir, "cloud-log.json"), "utf8"),
      );
      if (info.title) {
        folderName = info.title;
      } else if (info.fileName) {
        folderName = info.fileName.replace(/\.zip$/i, "");
      }
    } catch {
      // Not a cloud log folder
    }
    return {
      folderName,
      entries: await listSessionEntries(dir),
    };
  });

  /**
   * @event read-session-file
   * @async
   * @description Reads one file of a session folder as UTF-8 text.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {string} dir - Absolute path of the session folder.
   * @param {string} relativePath - Path inside that folder, as listed.
   * @returns {Promise<string>}
   * @throws {Error} If the path would escape the session folder.
   */
  ipcMain.handle("read-session-file", async (event, dir, relativePath) => {
    assertSessionSender(event);
    const root = resolve(dir);
    const target = resolve(root, relativePath);
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error("Refusing to read outside the session folder");
    }
    return await readFile(target, "utf-8");
  });

  // BLCU — only the file picker runs through IPC; all API calls go directly
  // from the renderer to http://localhost:8000.

  /**
   * @event blcu-select-file
   * @async
   * @description Opens a native file dialog to select a firmware file (.bin, .hex, .elf).
   * @returns {Promise<string | null>} The selected file path, or null if canceled.
   */
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

  /**
   * @event blcu-read-file
   * @async
   * @description Reads a firmware file from disk into a buffer.
   * @param {import("electron").IpcMainInvokeEvent} _event - The IPC event object.
   * @param {string} filePath - Absolute path to the firmware file.
   * @returns {Promise<Buffer>} The file contents buffer.
   */
  ipcMain.handle("blcu-read-file", async (_event, filePath) => {
    return await readFile(filePath);
  });
}

export { setupIpcHandlers };
