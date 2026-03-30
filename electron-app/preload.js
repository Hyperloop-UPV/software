/**
 * @module preload
 * @description Preload script that safely exposes Electron APIs to the renderer process.
 * Uses contextBridge to provide a secure IPC interface for communication with the main process.
 */

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Exposes Electron APIs to the renderer process via contextBridge.
 * All methods use ipcRenderer.invoke for secure two-way communication with the main process.
 * @type {Object}
 * @property {function(): Promise<string>} getCurrentView - Gets the name of the currently loaded view.
 * @property {function(string): Promise<string>} switchView - Switches to a different view.
 * @property {function(Object): Promise<boolean>} saveConfig - Saves the configuration object.
 * @property {function(): Promise<Object>} getConfig - Gets the current configuration object.
 * @property {function(): Promise<boolean>} importConfig - Imports configuration from a file dialog.
 * @property {function(): Promise<string | null>} selectFolder - Opens a folder selection dialog.
 * @example
 * // In renderer process:
 * const view = await window.electronAPI.getCurrentView();
 * await window.electronAPI.switchView("control-station");
 * const config = await window.electronAPI.getConfig();
 * await window.electronAPI.saveConfig({ database: { host: "localhost" } });
 */
contextBridge.exposeInMainWorld("electronAPI", {
  // Get the currently loaded view name
  getCurrentView: () => ipcRenderer.invoke("get-current-view"),
  // Switch to a different view by name
  switchView: (view) => ipcRenderer.invoke("switch-view", view),
  // Save configuration object to file
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  // Get current configuration object
  getConfig: () => ipcRenderer.invoke("get-config"),
  // Import configuration from file dialog
  importConfig: () => ipcRenderer.invoke("import-config"),
  // Open folder selection dialog
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  // Open a folder path in the OS file explorer
  openFolder: (path) => ipcRenderer.invoke("open-folder", path),
  // Receive log message from backend
  onLog: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.removeAllListeners("log");
    ipcRenderer.on("log", listener);
    return () => ipcRenderer.removeListener("log", listener);
  },
});
