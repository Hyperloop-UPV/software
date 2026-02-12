/**
 * @module main
 * @description Main entry point for the Electron application.
 * Handles application lifecycle, initialization, and cleanup of processes and windows.
 */

import { app, BrowserWindow, dialog } from "electron";
import pkg from "electron-updater";
import { getConfigManager } from "./src/config/configInstance.js";
import { setupIpcHandlers } from "./src/ipc/handlers.js";
import { startBackend, stopBackend } from "./src/processes/backend.js";
import { stopPacketSender } from "./src/processes/packetSender.js";
import { logger } from "./src/utils/logger.js";
import { createWindow } from "./src/windows/mainWindow.js";

const { autoUpdater } = pkg;

// Setup IPC handlers for renderer process communication
setupIpcHandlers();

// App lifecycle: wait for Electron to be ready
app.whenReady().then(async () => {
  // Initialize ConfigManager and ensure config exists BEFORE starting backend
  logger.electron.info("Initializing configuration...");
  // Get ConfigManager instance (creates config from template if needed)
  await getConfigManager();
  logger.electron.info("Configuration ready");

  // Start backend process
  startBackend();

  // Create main application window
  createWindow();

  // Check for updates
  // if (app.isPackaged) {
  autoUpdater.logger = logger.electron;
  autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.checkForUpdatesAndNotify();
  // }

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
app.on("before-quit", () => {
  // Stop backend process gracefully
  stopBackend();
  // Stop packet sender process gracefully
  stopPacketSender();
});

// Handle uncaught exceptions globally
process.on("uncaughtException", (error) => {
  // Log error to console
  logger.electron.error("Uncaught exception:", error);
  // Show error dialog to user
  dialog.showErrorBox("Error", error.message);
});
