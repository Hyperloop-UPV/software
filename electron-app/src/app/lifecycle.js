/**
 * @module app/lifecycle
 * @description Application lifecycle event handlers.
 */

import { app, BrowserWindow, dialog } from "electron";
import { stopBackend } from "../processes/backend.js";
import { stopBlcuProgramming } from "../processes/blcuProgramming.js";
import { logger } from "../utils/logger.js";
import { createWindow } from "../windows/index.js";

// Flag to indicate we're in a transition (e.g., returning to selector)
let isInTransition = false;

/**
 * Sets the transition flag
 * @param {boolean} inTransition
 */
function setTransitionMode(inTransition) {
  isInTransition = inTransition;
}

/**
 * Sets up all application lifecycle event handlers.
 * @returns {void}
 */
function setupLifecycleHandlers() {
  // Handle window close behavior
  app.on("window-all-closed", () => {
    // Don't quit if we're in a transition (returning to selector)
    if (isInTransition) {
      logger.electron.debug("In transition mode - skipping app quit on window-all-closed");
      return;
    }

    // On macOS, keep app running even when all windows are closed
    if (process.platform !== "darwin") {
      // Quit app on other platforms when all windows are closed
      app.quit();
    }
  });

  // Cleanup before app quits
  app.on("before-quit", (e) => {
    e.preventDefault();
    Promise.all([stopBackend(), stopBlcuProgramming()])
      .catch((error) => logger.electron.error("Error during shutdown:", error))
      .finally(() => app.exit());
  });

  // Handle macOS app activation (reopen window when dock icon clicked)
  app.on("activate", () => {
    // Only create window if no windows exist
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Handle uncaught exceptions globally
  process.on("uncaughtException", (error) => {
    logger.electron.error("Uncaught exception:", error);
    dialog.showErrorBox("Error", error.message);
  });
}

export { setTransitionMode, setupLifecycleHandlers };

