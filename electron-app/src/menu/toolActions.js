import { dialog, shell } from "electron";
import fs from "fs";
import path from "path";
import { readConfig } from "../config/configInstance.js";
import {
  getBackendCachePath,
  getBackendWorkingDir,
  getUserConfigPath,
} from "../utils/paths.js";
import { logger } from "../utils/logger.js";

const LINKS = {
  adj: "https://github.com/Hyperloop-UPV/adj",
  issue: "https://github.com/Hyperloop-UPV/software/issues/new/choose",
};

async function resolveLocation(location) {
  if (location === "cache") return getBackendCachePath();
  if (location === "settings") return path.dirname(getUserConfigPath());
  if (location === "config") return getUserConfigPath();

  if (location === "adj") return path.join(getBackendCachePath(), "adj");

  if (location === "logger") {
    const config = await readConfig();
    const loggerPath = path.resolve(
      getBackendWorkingDir(),
      config.logging?.logging_path ?? ".",
      "logger",
    );
    return loggerPath;
  }
  throw new Error(`Unknown application location: ${location}`);
}

async function reportOpenError(error, parentWindow) {
  logger.electron.error("Could not open application resource:", error.message);
  const options = {
    type: "error",
    title: "Could Not Open",
    message: "Could not open the requested file, folder, or page.",
    detail: error.message,
    buttons: ["OK"],
  };
  if (parentWindow && !parentWindow.isDestroyed()) {
    await dialog.showMessageBox(parentWindow, options);
  } else {
    await dialog.showMessageBox(options);
  }
}

/** Open files with the OS default application, and folders in its file manager. */
async function openAppLocation(location, parentWindow) {
  try {
    const target = await resolveLocation(location);
    if (location === "logger" && !fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    if (!fs.existsSync(target))
      throw new Error(`This location does not exist yet:\n${target}`);
    const error = await shell.openPath(target);
    if (error) throw new Error(`${error}\n${target}`);
  } catch (error) {
    await reportOpenError(error, parentWindow);
  }
}

async function openProjectLink(link, parentWindow) {
  try {
    const url = LINKS[link];
    if (!url) throw new Error(`Unknown project link: ${link}`);
    await shell.openExternal(url);
  } catch (error) {
    await reportOpenError(error, parentWindow);
  }
}

export { openAppLocation, openProjectLink };
