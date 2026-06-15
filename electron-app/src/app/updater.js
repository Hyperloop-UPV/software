/**
 * @module app/updater
 * @description Auto-updater configuration and event handling.
 */

import { app, dialog } from "electron";
import pkg from "electron-updater";
import { logger } from "../utils/logger.js";

const { autoUpdater } = pkg;

/**
 * Initializes the auto-updater with appropriate logging and event handlers.
 * @returns {void}
 */
function setupUpdater() {
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  // Configure auto-updater logging
  autoUpdater.logger = {
    info: (message) => logger.electron.info(message),
    error: (message) => logger.electron.error(message),
    warn: (message) => logger.electron.warning(message),
    debug: (message) => logger.electron.debug(message),
  };

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

  // Check for updates
  autoUpdater.checkForUpdates();
}

export { setupUpdater };
