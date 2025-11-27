import { ipcMain, dialog } from "electron";
import {
  readConfig,
  writeConfig,
  importConfig,
} from "../config/configInstance.js";
import { loadView, getCurrentView } from "../windows/mainWindow.js";
import { getMainWindow } from "../windows/mainWindow.js";

function setupIpcHandlers() {
  ipcMain.handle("get-current-view", () => getCurrentView());

  ipcMain.handle("switch-view", (event, view) => {
    loadView(view);
    return view;
  });

  ipcMain.handle("save-config", async (event, config) => {
    try {
      writeConfig(config);
      return true;
    } catch (error) {
      console.error("Error saving config:", error);
      throw error;
    }
  });

  ipcMain.handle("get-config", async () => {
    try {
      return await readConfig();
    } catch (error) {
      console.error("Error reading config:", error);
      throw error;
    }
  });

  ipcMain.handle("import-config", async () => {
    try {
      await importConfig();
      return true;
    } catch (error) {
      console.error("Error importing config:", error);
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
      console.error("Error selecting folder:", error);
      throw error;
    }
  });
}

export { setupIpcHandlers };
