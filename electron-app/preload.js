const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getCurrentView: () => ipcRenderer.invoke("get-current-view"),
  switchView: (view) => ipcRenderer.invoke("switch-view", view),
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  getConfig: () => ipcRenderer.invoke("get-config"),
  importConfig: () => ipcRenderer.invoke("import-config"),
  selectFolder: () => ipcRenderer.invoke("select-folder"),
});
