/**
 * @module windows
 * @description Main window management module for the Electron application.
 * Handles creation, view loading, and window state management.
 */

import { BrowserWindow, app, dialog } from "electron";
import fs from "fs";
import path from "path";
import { createMenu } from "../menu/menu.js";
import { getAppPath } from "../utils/paths.js";

// Get the application root path
const appPath = getAppPath();

// Store the main window instance
let mainWindow = null;
// Track the currently loaded view
let currentView = "testing-view";

/**
 * Creates and initializes the main application window.
 * @returns {void}
 * @example
 * createWindow();
 */
function createWindow(screenWidth, screenHeight) {
  // Create new browser window with configuration
  mainWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: screenWidth,
    height: screenHeight,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // Path to preload script for secure IPC
      preload: path.join(appPath, "preload.js"),
      // Enable context isolation for security
      contextIsolation: true,
      // Disable node integration for security
      nodeIntegration: false,
      // Disable background throttling to prevent data loss when window is minimized
      backgroundThrottling: false,
    },
    title: "Hyperloop Control Station",
    backgroundColor: "#1a1a1a",
  });

  // Load ethernet view by default
  loadView(currentView);

  // Create application menu
  const menu = createMenu(mainWindow);
  mainWindow.setMenu(menu);

  // Open DevTools in development mode
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Clear window reference when closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Loads a specific view into the main window.
 * @param {string} view - The name of the view to load (e.g., "ethernet-view", "control-station").
 * @returns {void}
 * @example
 * loadView("control-station");
 * loadView("ethernet-view");
 */
function loadView(view) {
  // Update current view tracking
  currentView = view;
  // Construct path to view HTML file
  const viewPath = path.join(appPath, "renderer", view, "index.html");

  // Check if view file exists
  if (fs.existsSync(viewPath)) {
    // Load the view HTML file
    mainWindow.loadFile(viewPath);
    // Update window title based on view type
    mainWindow.setTitle(
      `Hyperloop Control Station - ${
        view === "control-station" ? "Competition View" : "Testing View"
      }`
    );
  } else {
    // Log error and show dialog if view not found
    console.error(`View not found: ${viewPath}`);
    dialog.showErrorBox("Error", `View not found: ${view}`);
  }
}

/**
 * Reloads the main window.
 * @returns {void}
 * @example
 * reloadWindow();
 */
function reloadWindow() {
  if (mainWindow) {
    mainWindow.reload();
  }
}

/**
 * Returns the name of the currently loaded view.
 * @returns {string} The current view name (e.g., "ethernet-view", "control-station").
 * @example
 * const view = getCurrentView();
 * console.log(`Current view: ${view}`);
 */
function getCurrentView() {
  // Return the current view identifier
  return currentView;
}

/**
 * Returns the main BrowserWindow instance.
 * @returns {BrowserWindow | null} The main window instance, or null if the window has not been created or has been closed.
 * @example
 * const window = getMainWindow();
 * if (window) {
 *   window.maximize();
 * }
 */
function getMainWindow() {
  // Return the main window instance
  return mainWindow;
}

export { createWindow, getCurrentView, getMainWindow, loadView, reloadWindow };
