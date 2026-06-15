/**
 * @module main
 * @description Main entry point for the Electron application.
 * 
 * Orchestrates application lifecycle and initialization through modular components:
 * - initialization: Config, IPC, and process cleanup
 * - modeSelector: Mode selection UI and main window creation
 * - updater: Auto-update functionality
 * - lifecycle: App lifecycle event handling
 */

import { app, BrowserWindow, screen } from "electron";
import {
  handleSelectorFallback,
  initializeApp,
  setupLifecycleHandlers,
  setupUpdater,
  showModeSelector,
} from "./src/app/index.js";
import { stopBackend } from "./src/processes/backend.js";
import { stopBlcuProgramming } from "./src/processes/blcuProgramming.js";
import { logger } from "./src/utils/logger.js";

/**
 * Initializes the application when Electron is ready.
 * Orchestrates startup sequence:
 * 1. Initialize config and IPC
 * 2. Show mode selector
 * 3. Setup auto-updater
 * 4. Setup lifecycle handlers
 */
app.whenReady().then(async () => {
  try {
    // Initialize configuration, IPC, and cleanup
    await initializeApp();

    // Get screen dimensions for window creation
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    // Register return-to-selector handler before starting the app.
    app.on("return-to-selector", async () => {
      try {
        logger.electron.info("Returning to selector mode...");
        await Promise.all([stopBackend(), stopBlcuProgramming()]);

        const existingWindows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
        existingWindows.forEach((window) => window.hide());

        const { width: selectorWidth, height: selectorHeight } = screen.getPrimaryDisplay().workAreaSize;
        await showModeSelector(selectorWidth, selectorHeight);

        existingWindows.forEach((window) => {
          if (!window.isDestroyed()) {
            window.close();
          }
        });
      } catch (error) {
        logger.electron.error("Failed to return to selector:", error);
      }
    });

    // Show mode selector and get user choice
    try {
      await showModeSelector(screenWidth, screenHeight);
    } catch (error) {
      logger.electron.error("Mode selector failed:", error);
      await handleSelectorFallback(screenWidth, screenHeight);
    }

    // Setup auto-updater
    setupUpdater();

    // Setup application lifecycle handlers (window-all-closed, before-quit, activate, exceptions)
    setupLifecycleHandlers();
  } catch (error) {
    logger.electron.error("Failed to initialize application:", error);
    app.quit();
  }
});
