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
  openMode,
  setTransitionMode,
  setupLifecycleHandlers,
  setupUpdater,
  showModeSelector,
} from "./src/app/index.js";
import { stopBackend } from "./src/processes/backend.js";
import { stopBlcuProgramming } from "./src/processes/blcuProgramming.js";
import { logger } from "./src/utils/logger.js";
import { getCurrentView, getMainWindow } from "./src/windows/mainWindow.js";
import {
  createCompetitionWindow,
  createTestingWindow,
} from "./src/windows/additionalViewWindow.js";

/**
 * Initializes the application when Electron is ready.
 * Orchestrates startup sequence:
 * 1. Initialize config and IPC
 * 2. Register mode switching and lifecycle handlers
 * 3. Show mode selector
 * 4. Setup auto-updater
 */
app.whenReady().then(async () => {
  try {
    // Initialize configuration, IPC, and cleanup
    await initializeApp();

    // Get screen dimensions for window creation
    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize;

    // Keep startup and mode transitions exclusive, including shortcuts in other windows.
    let isChangingMode = true;
    async function changeMode(mode = null) {
      if (isChangingMode) return;
      if (mode && getCurrentView() === `${mode}-view`) {
        const mainWindow = getMainWindow();
        mainWindow?.show();
        mainWindow?.focus();
        return;
      }

      isChangingMode = true;
      setTransitionMode(true);
      let existingWindows = [];
      try {
        logger.electron.info(
          mode
            ? `Switching to ${mode} mode...`
            : "Returning to selector mode...",
        );
        await Promise.all([stopBackend(), stopBlcuProgramming()]);

        // Give ports time to be released (increased to 3s for TCP TIME_WAIT state)
        await new Promise((resolve) => setTimeout(resolve, 3000));

        existingWindows = BrowserWindow.getAllWindows().filter(
          (window) => !window.isDestroyed(),
        );
        existingWindows.forEach((window) => window.hide());

        const { width: selectorWidth, height: selectorHeight } =
          screen.getPrimaryDisplay().workAreaSize;
        if (mode) {
          await openMode(selectorWidth, selectorHeight, mode);
        } else {
          await showModeSelector(selectorWidth, selectorHeight);
        }

        existingWindows.forEach((window) => {
          if (!window.isDestroyed()) {
            window.removeAllListeners("close");
            window.close();
          }
        });
      } catch (error) {
        logger.electron.error("Failed to change mode:", error);
        existingWindows.forEach((window) => {
          if (!window.isDestroyed()) window.show();
        });
      } finally {
        isChangingMode = false;
        setTransitionMode(false);
      }
    }
    app.on("return-to-selector", () => changeMode());
    app.on("switch-mode", (mode) => changeMode(mode));
    app.on("new-testing-window", () => {
      if (
        isChangingMode ||
        !["testing-view", "competition-view"].includes(getCurrentView())
      )
        return;
      void createTestingWindow(getMainWindow());
    });
    app.on("new-competition-window", () => {
      if (isChangingMode || getCurrentView() !== "competition-view") return;
      void createCompetitionWindow(getMainWindow());
    });

    // Register shutdown cleanup before the selector can start any services.
    setupLifecycleHandlers();

    // Show mode selector and get user choice
    try {
      await showModeSelector(screenWidth, screenHeight);
    } catch (error) {
      logger.electron.error("Mode selector failed:", error);
      await handleSelectorFallback(screenWidth, screenHeight);
    } finally {
      isChangingMode = false;
    }

    // Setup auto-updater
    setupUpdater();
  } catch (error) {
    logger.electron.error("Failed to initialize application:", error);
    app.quit();
  }
});
