const { contextBridge, ipcRenderer } = require("electron");

// About gets a minimal bridge, not configuration, filesystem or backend access.
contextBridge.exposeInMainWorld("aboutAPI", {
  getCredits: () => ipcRenderer.invoke("about:credits"),
  openProfile: (id) => ipcRenderer.invoke("about:open-profile", id),
});
