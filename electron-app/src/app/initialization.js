/**
 * @module app/initialization
 * @description Application initialization: config setup and cleanup.
 */

import { app, Menu } from "electron";
import { getConfigManager } from "../config/configInstance.js";
import { setupIpcHandlers } from "../ipc/handlers.js";
import { createMenu } from "../menu/menu.js";
import { logger } from "../utils/logger.js";
import { cleanupLeftoverBackendProcesses } from "./cleanup.js";

/**
 * Initializes the application:
 * - Sets the default application menu (windows can override it)
 * - Sets up IPC handlers
 * - Initializes configuration
 * - Cleans up leftover processes
 * @returns {Promise<void>}
 */
async function initializeApp() {
  // macOS uses the application name for the leftmost menu's label.
  if (process.platform === "darwin") app.setName("Control Station");
  Menu.setApplicationMenu(createMenu());

  // Setup IPC handlers for renderer process communication
  setupIpcHandlers();

  // Initialize ConfigManager and ensure config exists
  logger.electron.header("Initializing configuration...");
  await getConfigManager();
  logger.electron.header("Configuration ready");

  // Clean up leftover processes from previous sessions
  await cleanupLeftoverBackendProcesses();
}

export { initializeApp };
