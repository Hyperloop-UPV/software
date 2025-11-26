const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getCurrentView: () => ipcRenderer.invoke("get-current-view"),
  switchView: (view) => ipcRenderer.invoke("switch-view", view),
});
