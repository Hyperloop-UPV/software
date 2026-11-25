/**
 * @module app/updater
 * @description Auto-updater configuration and event handling.
 */

import { app, dialog } from "electron";
import pkg from "electron-updater";
import { logger } from "../utils/logger.js";

const { autoUpdater } = pkg;
let updaterInitialized = false;
let manualCheck = null;

/**
 * Initializes the auto-updater with appropriate logging and event handlers.
 * @returns {void}
 */
function initializeUpdater() {
  if (updaterInitialized) return;
  updaterInitialized = true;

  // Configure auto-updater logging
  autoUpdater.logger = {
    info: (message) => logger.electron.info(message),
    error: (message) => logger.electron.error(message),
    warn: (message) => logger.electron.warning(message),
    debug: (message) => logger.electron.debug(message),
  };
  autoUpdater.on("error", (error) => {
    logger.electron.error("Updater error:", error.message);
  });

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
      })
      .catch((error) => logger.electron.error("Update dialog failed:", error));
  });
}

function setupUpdater() {
  initializeUpdater();
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates().catch((error) => {
    logger.electron.error("Update check failed:", error.message);
  });
}

/** Manual checks always report their result; installing still requires Restart. */
async function checkForUpdates(parentWindow) {
  if (manualCheck) return manualCheck;
  initializeUpdater();

  const showResult = (options) => {
    const dialogOptions = {
      title: "Check for Updates",
      buttons: ["OK"],
      ...options,
    };
    return parentWindow && !parentWindow.isDestroyed()
      ? dialog.showMessageBox(parentWindow, dialogOptions)
      : dialog.showMessageBox(dialogOptions);
  };

  manualCheck = (async () => {
    if (!app.isPackaged) {
      await showResult({
        type: "info",
        message:
          "Updates are available in installed builds of Control Station.",
        detail: `Current version: ${app.getVersion()}`,
      });
      return;
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      // Auto-downloads are started by electron-updater; handle their rejection too.
      result?.downloadPromise?.catch((error) => {
        logger.electron.error("Update download failed:", error.message);
        return showResult({
          type: "error",
          message: "Could not download the update.",
          detail: error.message,
        });
      });
      if (!result) {
        await showResult({
          type: "info",
          message: "Automatic updates are not available for this installation.",
        });
      } else if (result.isUpdateAvailable) {
        await showResult({
          type: "info",
          message: `Version ${result.updateInfo.version} is available.`,
          detail:
            "The update is downloading. You will be asked before restarting to install it.",
        });
      } else {
        await showResult({
          type: "info",
          message: "Control Station is up to date.",
          detail: `Current version: ${app.getVersion()}`,
        });
      }
    } catch (error) {
      logger.electron.error("Update check failed:", error.message);
      await showResult({
        type: "error",
        message: "Could not check for updates.",
        detail: error.message,
      });
    }
  })();

  try {
    await manualCheck;
  } finally {
    manualCheck = null;
  }
}

export { checkForUpdates, setupUpdater };
