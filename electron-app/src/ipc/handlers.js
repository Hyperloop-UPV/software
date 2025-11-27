const { ipcMain, dialog } = require("electron");
const {
  readConfig,
  writeConfig,
  importConfig,
} = require("../config/configManager");
const { loadView, getCurrentView } = require("../windows/mainWindow");
const { getMainWindow } = require("../windows/mainWindow");

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
      return readConfig();
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

module.exports = { setupIpcHandlers };
