import { BrowserWindow } from "electron";
import path from "path";

import { getAppPath } from "../utils/paths.js";

// Get the application root path
const appPath = getAppPath();

export const createLogWindow = (screenWidth, screenHeight) => {
  const logWindow = new BrowserWindow({
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

  const logFilePath = path.join(appPath, "src", "logs", "logs.html");
  logWindow.loadFile(logFilePath);

  return logWindow;
};
