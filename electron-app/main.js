/**
 * @module main
 * @description Main entry point for the Electron application.
 * Handles application lifecycle, initialization, and cleanup of processes and windows.
 */

import { app, BrowserWindow, dialog, screen } from "electron";
import pkg from "electron-updater";
import fs from "fs";
import { getConfigManager } from "./src/config/configInstance.js";
import { setupIpcHandlers } from "./src/ipc/handlers.js";
import { startBackend, stopBackend } from "./src/processes/backend.js";
import { stopPacketSender } from "./src/processes/packetSender.js";
import { logger } from "./src/utils/logger.js";
import { createLogWindow } from "./src/windows/logWindow.js";
import { createWindow } from "./src/windows/mainWindow.js";

const { autoUpdater } = pkg;

// Disable sandbox on Linux — sandbox restrictions vary across distros
// (AppArmor on Ubuntu, SELinux on Fedora, etc.) and this is an internal
// app where all content is trusted.
if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
}

// Setup IPC handlers for renderer process communication
setupIpcHandlers();

// App lifecycle: wait for Electron to be ready
app.whenReady().then(async () => {
  // Get the screen width and height
  // Only can be used inside app.whenReady()
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  // Initialize ConfigManager and ensure config exists BEFORE starting backend
  logger.electron.header("Initializing configuration...");
  // Get ConfigManager instance (creates config from template if needed)
  await getConfigManager();
  logger.electron.header("Configuration ready");

  const logWindow = createLogWindow(screenWidth, screenHeight);

  // Start backend process
  try {
    await startBackend(logWindow);
    logger.electron.header("Backend process spawned");
  } catch (error) {
    // Start backend already shows these errors
  }

  // Create main application window
  const mainWindow = createWindow(screenWidth, screenHeight);
  mainWindow.maximize();

  logger.electron.header("Main application window created");

  // Updater setup
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.logger = {
    info: (message) => logger.electron.info(message),
    error: (message) => logger.electron.error(message),
    warn: (message) => logger.electron.warning(message),
    debug: (message) => logger.electron.debug(message),
  };

  // Check for updates
  autoUpdater.checkForUpdates();

  // Handle update downloaded event
  autoUpdater.on("update-downloaded", (info) => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message: `Version ${info.version} has been downloaded. Restart now to install?`,
        buttons: ["Restart", "Later"],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  // Handle macOS app activation (reopen window when dock icon clicked)
  app.on("activate", () => {
    // Only create window if no windows exist
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle window close behavior
app.on("window-all-closed", () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== "darwin") {
    // Quit app on other platforms when all windows are closed
    app.quit();
  }
});

// Cleanup before app quits
app.on("before-quit", (e) => {
  e.preventDefault();
  Promise.all([stopBackend(), stopPacketSender()])
    .catch((error) => logger.electron.error("Error during shutdown:", error))
    .finally(() => app.exit());
});

// Handle uncaught exceptions globally
process.on("uncaughtException", (error) => {
  // Log error to console
  logger.electron.error("Uncaught exception:", error);
  // Show error dialog to user
  dialog.showErrorBox("Error", error.message);
});
