import { spawn } from "child_process";
import { dialog } from "electron";
import {
  getAppPath,
  getBinaryPath,
  getUserConfigPath,
} from "../utils/paths.js";
import fs from "fs";
import { app } from "electron";
import path from "path";
import { logger } from "../utils/logger.js";

const appPath = getAppPath();

let backendProcess = null;

function startBackend() {
  const backendBin = getBinaryPath("backend");
  const configPath = getUserConfigPath();

  if (!fs.existsSync(backendBin)) {
    logger.backend.error(`Backend binary not found: ${backendBin}`);
    dialog.showErrorBox("Error", `Backend binary not found at: ${backendBin}`);
    return;
  }

  logger.backend.info(`Starting backend: ${backendBin}, config: ${configPath}`);

  // Set working directory to backend/cmd in development, or resources in production
  const workingDir = !app.isPackaged
    ? path.join(appPath, "..", "backend", "cmd")
    : path.dirname(configPath);

  backendProcess = spawn(backendBin, ["--config", configPath], {
    cwd: workingDir,
  });

  backendProcess.stdout.on("data", (data) => {
    logger.backend.info(`${data.toString().trim()}`);
  });

  backendProcess.on("error", (error) => {
    logger.backend.error(`Failed to start backend: ${error.message}`);
    dialog.showErrorBox(
      "Backend Error",
      `Failed to start backend: ${error.message}`
    );
  });

  backendProcess.on("close", (code) => {
    logger.backend.info(`Backend process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      dialog.showErrorBox(
        "Backend Crashed",
        `Backend exited with code ${code}`
      );
    }
  });
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    logger.backend.info("Stopping backend...");
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
}

function restartBackend() {
  stopBackend();
  startBackend();
}

export { startBackend, stopBackend, restartBackend };
