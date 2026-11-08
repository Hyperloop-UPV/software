/**
 * @module app/modeSelector
 * @description Mode selector window and logic for initial app mode selection.
 */

import { app, BrowserWindow, ipcMain, screen } from "electron";
import fs from "fs";
import path from "path";
import { startBackend } from "../processes/backend.js";
import { startBlcuProgramming } from "../processes/blcuProgramming.js";
import { logger } from "../utils/logger.js";
import { getAppPath } from "../utils/paths.js";
import { createLogWindow, createWindow } from "../windows/index.js";
import { loadView } from "../windows/mainWindow.js";
import { setWindowMenu } from "../menu/menu.js";

const VALID_MODES = {
  testing: "testing-view",
  flashing: "flashing-view",
  competition: "competition-view",
  logging: "logging-view",
  adj: "adj-view",
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
    let modeSelected = false;
    const { x, y, width, height } = screen.getPrimaryDisplay().bounds;

    const selectorWindow = new BrowserWindow({
      // Cover the desktop without native fullscreen, which can make transparent
      // windows opaque or move them to a separate desktop space. A 1px inset also
      // prevents the compositor from treating a screen-sized window as fullscreen.
      x: x + 1,
      y: y + 1,
      width: width - 2,
      height: height - 2,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      fullscreen: false,
      fullscreenable: false,
      maximizable: false,
      resizable: false,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: path.join(getAppPath(), "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
      title: "Select Mode",
    });

    setWindowMenu(selectorWindow, { isSelector: true });

    selectorWindow.on("closed", () => {
      ipcMain.removeListener("mode-selected", onModeSelected);
      // Closing the selector cancels startup, including return-to-selector flows
      // where the previous application's windows are still hidden.
      if (!modeSelected) app.quit();
    });

    const selectorPath = path.join(
      getAppPath(),
      "renderer",
      "mode-selector",
      "index.html",
    );

    if (!fs.existsSync(selectorPath)) {
      logger.electron.warning(
        "Mode selector UI not found, using default testing-view",
      );
      modeSelected = true;
      resolve(handleSelectorFallback(screenWidth, screenHeight));
      selectorWindow.close();
      return;
    }

    logger.electron.info(`Mode selector found: ${selectorPath}`);

    ipcMain.on("mode-selected", onModeSelected);

    try {
      await selectorWindow.loadFile(selectorPath);
      if (!selectorWindow.isDestroyed()) {
        selectorWindow.show();
        selectorWindow.focus();
      }
    } catch (err) {
      logger.electron.error("Failed to load selector UI:", err);
      modeSelected = true;
      resolve(handleSelectorFallback(screenWidth, screenHeight));
      selectorWindow.close();
      return;
    }

    // Listen for mode selection from renderer
    async function onModeSelected(event, mode) {
      if (event.sender !== selectorWindow.webContents || modeSelected) return;
      modeSelected = true;
      ipcMain.removeListener("mode-selected", onModeSelected);
      try {
        resolve(await openMode(screenWidth, screenHeight, mode));
      } catch (error) {
        logger.electron.error("Error handling mode selection:", error);
        reject(error);
      } finally {
        try {
          selectorWindow.close();
        } catch (e) {}
      }
    }
  });
}

/** Open a mode using the same service startup sequence as the selector. */
async function openMode(screenWidth, screenHeight, mode) {
  const view = VALID_MODES[mode] || VALID_MODES.default;
  const mainWindow = createWindow(screenWidth, screenHeight, null);
  mainWindow.maximize();
  logger.electron.header("Main application window created");

  await startServices(screenWidth, screenHeight, view);
  loadView(view);
  mainWindow.show();
  mainWindow.focus();

  return { mode, view, mainWindow };
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
  // Start backend for testing and competition views
  if (view === "testing-view" || view === "competition-view") {
    const logWindow = createLogWindow(screenWidth, screenHeight);
    logWindow.show(); // Show the log window

    try {
      await startBackend();
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
      // Wait 5 seconds to ensure that BLCU programming (backend of frontend) is fully initialized
      await new Promise((resolve) => setTimeout(resolve, 5000));
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
  return openMode(screenWidth, screenHeight, "default");
}

export { handleSelectorFallback, openMode, showModeSelector };
