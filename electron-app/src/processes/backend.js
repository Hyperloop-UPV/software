/**
 * @module processes
 * @description Backend process management for spawning and controlling the backend binary.
 * Handles starting, stopping, and restarting the backend process with proper error handling and logging.
 */

import { spawn } from "child_process";
import { app, dialog } from "electron";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";
import {
  getAppPath,
  getBinaryPath,
  getUserConfigPath,
} from "../utils/paths.js";

// Get the application root path
const appPath = getAppPath();

// Store the backend process instance
let backendProcess = null;

// Store error messages (keep last 10 lines to avoid memory issues)
let lastBackendError = null;

/**
 * Starts the backend process by spawning the backend binary with the user configuration.
 * @returns {void}
 * @example
 * startBackend();
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    // Get paths for binary and config
    const backendBin = getBinaryPath("backend");
    const configPath = getUserConfigPath();

    // Check if binary exists before attempting to start
    if (!fs.existsSync(backendBin)) {
      logger.backend.error(`Backend binary not found: ${backendBin}`);
      dialog.showErrorBox(
        "Error",
        `Backend binary not found at: ${backendBin}`
      );
      return reject(new Error(`Backend binary not found: ${backendBin}`));
    }

    logger.backend.info(
      `Starting backend: ${backendBin}, config: ${configPath}`
    );

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

    // Capture stderr output (where Go errors/panics are written)
    backendProcess.stderr.on("data", (data) => {
      const errorMsg = data.toString().trim();
      logger.backend.error(errorMsg);
      // Store the last error message
      lastBackendError = errorMsg;
    });

    // Handle spawn errors
    backendProcess.on("error", (error) => {
      logger.backend.error(`Failed to start backend: ${error.message}`);
      dialog.showErrorBox(
        "Backend Error",
        `Failed to start backend: ${error.message}`
      );
      return reject(new Error(`Failed to start backend: ${error.message}`));
    });

    // If the backend didn't fail in this period of time, resolve the promise
    setTimeout(() => {
      resolve(backendProcess);
    }, 4000);

    // Handle process exit
    backendProcess.on("close", (code) => {
      logger.backend.info(`Backend process exited with code ${code}`);
      // Show error dialog if process crashed (non-zero exit code)
      if (code !== 0 && code !== null) {
        // Build error message with actual error details
        let errorMessage = `Backend exited with code ${code}`;

        if (lastBackendError) {
          errorMessage += `\n\n${lastBackendError}`;
        } else {
          errorMessage += "\n\n(No error output captured)";
        }

        dialog.showErrorBox("Backend Crashed", errorMessage);
        // Clear error message after showing
        lastBackendError = null;
      }
    });
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

export { restartBackend, startBackend, stopBackend };
