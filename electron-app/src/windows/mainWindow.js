const { BrowserWindow, app, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { createMenu } = require("../menu/menu");

let mainWindow = null;
let currentView = "ethernet-view";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, "..", "..", "preload.js"),
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
  const viewPath = path.join(
    __dirname,
    "..",
    "..",
    "renderer",
    view,
    "index.html"
  );

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

module.exports = { createWindow, loadView, getCurrentView, getMainWindow };
