/**
 * @module preload
 * @description Preload script that safely exposes Electron APIs to the renderer process.
 * Uses contextBridge to provide a secure IPC interface for communication with the main process.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Cloud Logs API: credentials, sync, and transfer progress
  cloudLogs: {
    getCredentialsStatus: () =>
      ipcRenderer.invoke("cloud-logs:credentials-status"),
    setCredentials: (input) =>
      ipcRenderer.invoke("cloud-logs:credentials-save", input),
    clearCredentials: () => ipcRenderer.invoke("cloud-logs:credentials-clear"),
    getLocalSessions: () => ipcRenderer.invoke("cloud-logs:local-sessions"),
    selectSession: () => ipcRenderer.invoke("cloud-logs:select-session"),
    list: (cursor) => ipcRenderer.invoke("cloud-logs:list", cursor),
    autocompleteTags: (query) => ipcRenderer.invoke("cloud-logs:tags", query),
    upload: (input) => ipcRenderer.invoke("cloud-logs:upload", input),
    download: (input) => ipcRenderer.invoke("cloud-logs:download", input),
    getDownloads: () => ipcRenderer.invoke("cloud-logs:downloads"),
    // Subscribe to transfer progress; returns an unsubscribe callback
    onProgress: (callback) => {
      const listener = (_event, progress) => callback(progress);
      ipcRenderer.on("cloud-logs:progress", listener);
      return () => ipcRenderer.removeListener("cloud-logs:progress", listener);
    },
  },
  // Get the currently loaded view name
  getCurrentView: () => ipcRenderer.invoke("get-current-view"),
  // Switch to a different view by name, optionally passing query params
  // through to the loaded view's URL (e.g. an ADJ commit hash)
  switchView: (view, query) => ipcRenderer.invoke("switch-view", view, query),
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
  // Logging View: list and read a session folder by path, so a recently used
  // session can be reopened without going through the folder picker
  listSessionFiles: (dir) => ipcRenderer.invoke("list-session-files", dir),
  readSessionFile: (dir, relativePath) =>
    ipcRenderer.invoke("read-session-file", dir, relativePath),
  // BLCU: open native file picker and return the selected path
  blcuSelectFile: () => ipcRenderer.invoke("blcu-select-file"),
  // BLCU: read a file from disk and return its contents as a Buffer
  blcuReadFile: (path) => ipcRenderer.invoke("blcu-read-file", path),
  // Get the application version from the main process
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  // Restart the backend process and reload the renderer when ready
  restartBackend: () => ipcRenderer.invoke("restart-backend"),
  // Get the list of views available in this build
  getAvailableViews: () => ipcRenderer.invoke("get-available-views"),
  // Run the kernel setup script (used by mode selector renderer)
  setupKernel: () => ipcRenderer.invoke("setup-kernel"),
  // Set initial mode (used by mode selector renderer)
  setInitialMode: (mode) => {
    ipcRenderer.send("mode-selected", mode);
    return Promise.resolve();
  },
  // Subscribes to backend log messages; returns an unsubscribe callback.
  onLog: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.removeAllListeners("log");
    ipcRenderer.on("log", listener);
    return () => ipcRenderer.removeListener("log", listener);
  },
});
