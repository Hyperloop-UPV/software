import { BrowserWindow, app, dialog } from "electron";
import path from "path";
import fs from "fs";
import { createMenu } from "../menu/menu.js";
import { getAppPath } from "../utils/paths.js";

const appPath = getAppPath();

let mainWindow = null;
let currentView = "ethernet-view";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      preload: path.join(appPath, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Hyperloop Control Station",
    backgroundColor: "#1a1a1a",
  });

  // Load ethernet view by default
  loadView("ethernet-view");

  // Create menu
  createMenu(mainWindow);

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function loadView(view) {
  currentView = view;
  const viewPath = path.join(appPath, "renderer", view, "index.html");

  if (fs.existsSync(viewPath)) {
    mainWindow.loadFile(viewPath);
    mainWindow.setTitle(
      `Hyperloop Control Station - ${
        view === "control-station" ? "Competition View" : "Testing View"
      }`
    );
  } else {
    console.error(`View not found: ${viewPath}`);
    dialog.showErrorBox("Error", `View not found: ${view}`);
  }
}

function getCurrentView() {
  return currentView;
}

function getMainWindow() {
  return mainWindow;
}

export { createWindow, loadView, getCurrentView, getMainWindow };
