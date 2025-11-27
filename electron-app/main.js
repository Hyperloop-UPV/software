import { app, dialog } from "electron";
import { createWindow } from "./src/windows/mainWindow.js";
import { startBackend, stopBackend } from "./src/processes/backend.js";
import { setupIpcHandlers } from "./src/ipc/handlers.js";
import { getConfigManager } from "./src/config/configInstance.js";
import { stopPacketSender } from "./src/processes/packetSender.js";

// Setup IPC handlers
setupIpcHandlers();

// App lifecycle
app.whenReady().then(async () => {
  // Initialize ConfigManager and ensure config exists BEFORE starting backend
  console.log("Initializing configuration...");
  await getConfigManager();
  console.log("Configuration ready");

  startBackend();
  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
  stopPacketSender();
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  dialog.showErrorBox("Error", error.message);
});
