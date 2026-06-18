/**
 * @module app/modeSelector
 * @description Mode selector window and logic for initial app mode selection.
 */

import { BrowserWindow, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { startBackend } from "../processes/backend.js";
import { startBlcuProgramming } from "../processes/blcuProgramming.js";
import { logger } from "../utils/logger.js";
import { getAppPath } from "../utils/paths.js";
import { createLogWindow, createWindow } from "../windows/index.js";
import { loadView } from "../windows/mainWindow.js";

const VALID_MODES = {
  testing: "testing-view",
  flashing: "flashing-view",
  default: "testing-view",
};

/**
 * Creates and displays the mode selector window.
 * Returns a Promise that resolves when user selects a mode.
 * @param {number} screenWidth
 * @param {number} screenHeight
 * @returns {Promise<{mode: string, view: string, mainWindow: BrowserWindow}>}
 */
async function showModeSelector(screenWidth, screenHeight) {
  return new Promise(async (resolve, reject) => {
    let mainWindow = null;

    const selectorWindow = new BrowserWindow({
      width: 920,
      height: 680,
      useContentSize: true,
      resizable: true,
      modal: true,
      parent: mainWindow,
      show: true,
      webPreferences: {
        preload: path.join(getAppPath(), "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
      title: "Select Mode",
    });

    const selectorPath = path.join(getAppPath(), "renderer", "mode-selector", "index.html");

    if (!fs.existsSync(selectorPath)) {
      logger.electron.warning("Mode selector UI not found, using default testing-view");
      resolve({ mode: "default", view: VALID_MODES.default, mainWindow: null });
      return;
    }

    logger.electron.info(`Mode selector found: ${selectorPath}`);

    try {
      await selectorWindow.loadFile(selectorPath);
      selectorWindow.show();
      selectorWindow.focus();
    } catch (err) {
      logger.electron.error("Failed to load selector UI:", err);
      resolve({ mode: "default", view: VALID_MODES.default, mainWindow: null });
      return;
    }

    // Listen for mode selection from renderer
    ipcMain.once("mode-selected", async (_event, mode) => {
      try {
        const view = VALID_MODES[mode] || VALID_MODES.default;

        // Create the main window without loading the view yet.
        mainWindow = createWindow(screenWidth, screenHeight, null);
        try {
          mainWindow.maximize();
        } catch (e) {}
        logger.electron.header("Main application window created");

        // Start services and only then load the selected view.
        if (view === "testing-view" || view === "flashing-view") {
          await startServices(screenWidth, screenHeight, view);
        }

        loadView(view);

        // Show and focus main window
        try {
          mainWindow.show();
          mainWindow.focus();
        } catch (e) {}

        resolve({ mode, view, mainWindow });
      } catch (error) {
        logger.electron.error("Error handling mode selection:", error);
        reject(error);
      } finally {
        try {
          selectorWindow.close();
        } catch (e) {}
      }
    });
  });
}

/**
 * Starts services based on the selected view.
 * - testing-view: Backend only
 * - flashing-view: BLCU Programming only
 * @param {number} screenWidth
 * @param {number} screenHeight
 * @param {string} view - The selected view mode
 * @returns {Promise<void>}
 */
async function startServices(screenWidth, screenHeight, view) {
  // Start backend only for testing view
  if (view === "testing-view") {
    const logWindow = createLogWindow(screenWidth, screenHeight);
    logWindow.show(); // Show the log window

    try {
      await startBackend(logWindow);
      logger.electron.header("Backend process spawned");
    } catch (err) {
      logger.electron.error("Failed to start backend:", err);
      if (logWindow && !logWindow.isDestroyed()) {
        logWindow.close();
      }
    }
  }

  // Start BLCU Programming only for flashing view
  if (view === "flashing-view") {
    try {
      await startBlcuProgramming();
      logger.electron.header("BLCU programming process spawned");
    } catch (err) {
      logger.electron.error("Failed to start BLCU programming:", err);
    }
  }
}

/**
 * Handles fallback when selector is not available or fails.
 * @param {number} screenWidth
 * @param {number} screenHeight
 * @returns {Promise<{mode: string, view: string, mainWindow: BrowserWindow}>}
 */
async function handleSelectorFallback(screenWidth, screenHeight) {
  const view = VALID_MODES.default;
  const mainWindow = createWindow(screenWidth, screenHeight, view);

  try {
    mainWindow.maximize();
  } catch (e) {}

  logger.electron.header("Main application window created");

  try {
    mainWindow.show();
  } catch (e) {}

  // Start services by default (testing view)
  await startServices(screenWidth, screenHeight, view);

  return { mode: "default", view, mainWindow };
}

export { handleSelectorFallback, showModeSelector };

