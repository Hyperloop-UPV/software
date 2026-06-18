/**
 * @module app/initialization
 * @description Application initialization: config setup and cleanup.
 */

import { getConfigManager } from "../config/configInstance.js";
import { setupIpcHandlers } from "../ipc/handlers.js";
import { logger } from "../utils/logger.js";
import { cleanupLeftoverBackendProcesses } from "./cleanup.js";

/**
 * Initializes the application:
 * - Sets up IPC handlers
 * - Initializes configuration
 * - Cleans up leftover processes
 * @returns {Promise<void>}
 */
async function initializeApp() {
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
