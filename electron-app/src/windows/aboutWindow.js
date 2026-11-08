/**
 * @module windows/aboutWindow
 * @description Application information, installed version, and Logging View credit.
 * Reachable via the main window's right-click context menu and the
 * Help > About application menu item.
 */

import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import path from "path";
import { pathToFileURL } from "node:url";
import { getAppPath } from "../utils/paths.js";
import { logger } from "../utils/logger.js";
import { setWindowMenu } from "../menu/menu.js";
import { getAboutCredits } from "../about/githubCredits.js";

let aboutWindow = null;
let ipcInitialized = false;

function setupAboutIpc() {
  if (ipcInitialized) return;
  const assertSender = (event) => {
    const url = pathToFileURL(
      path.join(getAppPath(), "renderer", "about", "index.html"),
    ).href;
    if (
      !aboutWindow ||
      event.sender !== aboutWindow.webContents ||
      event.senderFrame !== aboutWindow.webContents.mainFrame ||
      event.senderFrame.url !== url
    ) {
      throw new Error("About IPC is restricted to the About window");
    }
  };
  ipcMain.handle("about:credits", async (event) => {
    assertSender(event);
    return {
      ...getAboutCredits(),
      version: app.getVersion(),
    };
  });
  ipcMain.handle("about:open-profile", async (event, id) => {
    assertSender(event);
    if (typeof id !== "string" || id.length > 100)
      throw new Error("Invalid contributor");
    const person = getAboutCredits().contributors.find(
      (person) => person.id === id,
    );
    if (!person?.login || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(person.login))
      throw new Error("Contributor has no GitHub profile");
    await shell.openExternal(`https://github.com/${person.login}`);
  });
  ipcInitialized = true;
}

/**
 * Shows the About window, creating it if needed. Reuses a single instance —
 * focuses it instead of stacking duplicates if already open.
 * @param {BrowserWindow | null} [parentWindow] - Window to center/modal against.
 * @returns {void}
 */
function showAboutWindow(parentWindow) {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    if (aboutWindow.isMinimized()) aboutWindow.restore();
    aboutWindow.focus();
    return;
  }

  setupAboutIpc();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  aboutWindow = new BrowserWindow({
    width: Math.min(700, width - 48),
    height: Math.min(800, height - 64),
    minWidth: Math.min(420, width - 48),
    minHeight: Math.min(540, height - 64),
    resizable: true,
    minimizable: false,
    maximizable: true,
    modal: !!parentWindow,
    parent: parentWindow ?? undefined,
    title: "About Control Station",
    backgroundColor: "#161a2d",
    webPreferences: {
      preload: path.join(getAppPath(), "src", "windows", "aboutPreload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  setWindowMenu(aboutWindow);

  const aboutPath = path.join(getAppPath(), "renderer", "about", "index.html");
  // All outbound links go through the explicit IPC allowlist in the system browser.
  aboutWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  aboutWindow.webContents.on("will-navigate", (event) =>
    event.preventDefault(),
  );
  aboutWindow.loadFile(aboutPath).catch((err) => {
    logger.electron.error("Failed to load About window:", err);
  });

  aboutWindow.on("closed", () => {
    aboutWindow = null;
  });
}

export { showAboutWindow };
