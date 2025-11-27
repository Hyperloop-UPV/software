import { ipcMain, dialog } from "electron";
import {
  readConfig,
  writeConfig,
  importConfig,
} from "../config/configInstance.js";
import { loadView, getCurrentView } from "../windows/mainWindow.js";
import { getMainWindow } from "../windows/mainWindow.js";
import { restartBackend } from "../processes/backend.js";
import { logger } from "../utils/logger.js";

function setupIpcHandlers() {
  ipcMain.handle("get-current-view", () => getCurrentView());

  ipcMain.handle("switch-view", (event, view) => {
    loadView(view);
    return view;
  });

  ipcMain.handle("save-config", async (event, config) => {
    try {
      await writeConfig(config);
      restartBackend();
      return true;
    } catch (error) {
      logger.electron.error("Error saving config:", error);
      throw error;
    }
  });

  ipcMain.handle("get-config", async () => {
    try {
      return await readConfig();
    } catch (error) {
      logger.electron.error("Error reading config:", error);
      throw error;
    }
  });

  ipcMain.handle("import-config", async () => {
    try {
      await importConfig();
      restartBackend();
      return true;
    } catch (error) {
      logger.electron.error("Error importing config:", error);
      throw error;
    }
  });

  ipcMain.handle("select-folder", async () => {
    try {
      const mainWindow = getMainWindow();
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Select Logging Folder",
        properties: ["openDirectory"],
      });

      if (result.canceled) {
        return null;
      }

      return result.filePaths[0] || null;
    } catch (error) {
      logger.electron.error("Error selecting folder:", error);
      throw error;
    }
  });
}

export { setupIpcHandlers };
