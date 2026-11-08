import { BrowserWindow, dialog, screen } from "electron";
import fs from "node:fs";
import path from "node:path";
import { setWindowMenu } from "../menu/menu.js";
import { getAppPath } from "../utils/paths.js";
import { logger } from "../utils/logger.js";

// Keep secondary windows alive without replacing the application's main window.
const additionalWindows = new Set();

/** Open another Testing renderer connected to the existing backend. */
export function createTestingWindow(sourceWindow) {
  return createAdditionalWindow("testing-view", "Testing View", sourceWindow);
}

/** Open another Competition renderer connected to the existing backend. */
export function createCompetitionWindow(sourceWindow) {
  return createAdditionalWindow(
    "competition-view",
    "Competition View",
    sourceWindow,
  );
}

async function createAdditionalWindow(view, title, sourceWindow) {
  const appPath = getAppPath();
  const entry = path.join(appPath, "renderer", view, "index.html");
  if (!fs.existsSync(entry)) return null;

  const display =
    sourceWindow && !sourceWindow.isDestroyed()
      ? screen.getDisplayMatching(sourceWindow.getBounds())
      : screen.getPrimaryDisplay();
  const width = Math.min(1280, display.workAreaSize.width);
  const height = Math.min(800, display.workAreaSize.height);
  const window = new BrowserWindow({
    width,
    height,
    x:
      display.workArea.x + Math.floor((display.workAreaSize.width - width) / 2),
    y:
      display.workArea.y +
      Math.floor((display.workAreaSize.height - height) / 2),
    minWidth: Math.min(800, display.workAreaSize.width),
    minHeight: Math.min(600, display.workAreaSize.height),
    title: `Hyperloop Control Station - ${title}`,
    backgroundColor: "#1a1a1a",
    show: false,
    webPreferences: {
      preload: path.join(appPath, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  additionalWindows.add(window);
  setWindowMenu(window);
  // Closing a secondary window must not quit Control Station or stop its services.
  window.on("closed", () => additionalWindows.delete(window));

  try {
    await window.loadFile(entry);
    if (window.isDestroyed()) return null;
    window.show();
    window.focus();
    return window;
  } catch (error) {
    // Closing the window or switching mode while it loads is not a load failure.
    if (window.isDestroyed()) return null;
    logger.electron.error(`Failed to load additional ${title} window:`, error);
    window.close();
    dialog.showErrorBox(`Could Not Open ${title}`, error.message);
    return null;
  }
}
