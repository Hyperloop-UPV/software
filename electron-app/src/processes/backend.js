/**
 * @module processes
 * @description Backend process management for spawning and controlling the backend binary.
 * Handles starting, stopping, and restarting the backend process with proper error handling and logging.
 */

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

// Get the application root path
const appPath = getAppPath();

// Store the backend process instance
let backendProcess = null;

/**
 * Starts the backend process by spawning the backend binary with the user configuration.
 * @returns {void}
 * @example
 * startBackend();
 */
function startBackend() {
  // Get paths for binary and config
  const backendBin = getBinaryPath("backend");
  const configPath = getUserConfigPath();

  // Check if binary exists before attempting to start
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

  // Spawn the backend process with config argument
  backendProcess = spawn(backendBin, ["--config", configPath], {
    cwd: workingDir,
  });

  // Log stdout output from backend
  backendProcess.stdout.on("data", (data) => {
    logger.backend.info(`${data.toString().trim()}`);
  });

  // Handle spawn errors
  backendProcess.on("error", (error) => {
    logger.backend.error(`Failed to start backend: ${error.message}`);
    dialog.showErrorBox(
      "Backend Error",
      `Failed to start backend: ${error.message}`
    );
  });

  // Handle process exit
  backendProcess.on("close", (code) => {
    logger.backend.info(`Backend process exited with code ${code}`);
    // Show error dialog if process crashed (non-zero exit code)
    if (code !== 0 && code !== null) {
      dialog.showErrorBox(
        "Backend Crashed",
        `Backend exited with code ${code}`
      );
    }
  });
}

/**
 * Stops the backend process by sending a SIGTERM signal.
 * @returns {void}
 * @example
 * stopBackend();
 */
function stopBackend() {
  // Only stop if process exists and is still running
  if (backendProcess && !backendProcess.killed) {
    logger.backend.info("Stopping backend...");
    // Send termination signal
    backendProcess.kill("SIGTERM");
    // Clear the process reference
    backendProcess = null;
  }
}

/**
 * Restarts the backend process by stopping the current process and starting a new one.
 * @returns {void}
 * @example
 * restartBackend();
 */
function restartBackend() {
  // Stop current process first
  stopBackend();
  // Start a new process
  startBackend();
}

export { startBackend, stopBackend, restartBackend };
