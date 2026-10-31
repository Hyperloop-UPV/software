import { BrowserWindow, screen } from "electron";
import path from "path";

import { getAppPath } from "../utils/paths.js";
import { setWindowMenu } from "../menu/menu.js";

// Get the application root path
const appPath = getAppPath();
const MAX_LOG_ENTRIES = 2000;
let logWindow = null;
let logWindowReady = false;
let logHistory = [];

export const createLogWindow = (screenWidth, screenHeight) => {
  if (logWindow && !logWindow.isDestroyed()) return logWindow;

  const window = new BrowserWindow({
    x: Math.floor(screenWidth * 0.65),
    y: 0,
    width: Math.floor(screenWidth * 0.35),
    height: screenHeight,
    title: "Backend Logs",
    webPreferences: {
      preload: path.join(appPath, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  logWindow = window;
  logWindowReady = false;

  setWindowMenu(window);
  window.webContents.on("did-start-loading", () => {
    if (logWindow === window) logWindowReady = false;
  });
  window.webContents.on("did-finish-load", () => {
    if (logWindow !== window) return;
    logWindowReady = true;
    for (const entry of logHistory) window.webContents.send("log", entry);
  });
  window.on("closed", () => {
    if (logWindow === window) {
      logWindow = null;
      logWindowReady = false;
    }
  });

  const logFilePath = path.join(appPath, "src", "log-viewer", "index.html");
  window.loadFile(logFilePath);

  return window;
};

export function showLogWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const window = createLogWindow(width, height);
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

/** Buffer recent output even while the log window is closed or reloading. */
export function appendBackendLog(entry) {
  logHistory.push(entry);
  if (logHistory.length > MAX_LOG_ENTRIES) logHistory.shift();
  if (logWindowReady && logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents.send("log", entry);
  }
}

/** End the current logging session when its backend is stopped. */
export function clearLogWindow() {
  logHistory = [];
  if (logWindow && !logWindow.isDestroyed()) logWindow.close();
}
