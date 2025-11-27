const { app, dialog } = require("electron");
const { createWindow } = require("./src/windows/mainWindow");
const { startBackend } = require("./src/processes/backend");
const { setupIpcHandlers } = require("./src/ipc/handlers");

// Setup IPC handlers
setupIpcHandlers();

// App lifecycle
app.whenReady().then(() => {
  startBackend();
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on("activate", () => {
    if (require("electron").BrowserWindow.getAllWindows().length === 0) {
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
  const { stopBackend } = require("./src/processes/backend");
  const { stopPacketSender } = require("./src/processes/packetSender");
  stopBackend();
  stopPacketSender();
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  dialog.showErrorBox("Error", error.message);
});
