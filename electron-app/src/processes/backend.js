/**
 * @module processes
 * @description Backend process management for spawning and controlling the backend binary.
 * Handles starting, stopping, and restarting the backend process with proper error handling and logging.
 */

import AnsiToHtml from "ansi-to-html";
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

// Create ANSI to HTML converter
const convert = new AnsiToHtml();

// Get the application root path
const appPath = getAppPath();

// Store the backend process instance
let backendProcess = null;

// Common log window instance for all backend processes
let storedLogWindow = null;

// Store error messages (keep last 10 lines to avoid memory issues)
let lastBackendError = null;

/**
 * Starts the backend process by spawning the backend binary with the user configuration.
 * @returns {void}
 * @example
 * startBackend();
 */
async function startBackend(logWindow = null) {
  if (logWindow) {
    storedLogWindow = logWindow;
  }

  const currentLogWindow = logWindow || storedLogWindow;

  return new Promise((resolve, reject) => {
    // Get paths for binary and config
    const backendBin = getBinaryPath("backend");
    const configPath = getUserConfigPath();

    // Check if binary exists before attempting to start
    if (!fs.existsSync(backendBin)) {
      logger.backend.error(`Backend binary not found: ${backendBin}`);
      dialog.showErrorBox(
        "Error",
        `Backend binary not found at: ${backendBin}`,
      );
      return reject(new Error(`Backend binary not found: ${backendBin}`));
    }

    logger.backend.info(
      `Starting backend: ${backendBin}, config: ${configPath}`,
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

      // Send log message to log window
      if (currentLogWindow && !currentLogWindow.isDestroyed()) {
        const htmlData = convert.toHtml(data.toString().trim());
        currentLogWindow.webContents.send("log", htmlData);
      }
    });

    // Capture stderr output (where Go errors/panics are written)
    backendProcess.stderr.on("data", (data) => {
      const errorMsg = data.toString().trim();
      logger.backend.error(errorMsg);
      lastBackendError = errorMsg;

      // Send error message to log window
      if (currentLogWindow && !currentLogWindow.isDestroyed()) {
        const htmlError = convert.toHtml(errorMsg);
        currentLogWindow.webContents.send("log", htmlError);
      }
    });

    // Handle spawn errors
    backendProcess.on("error", (error) => {
      logger.backend.error(`Failed to start backend: ${error.message}`);
      dialog.showErrorBox(
        "Backend Error",
        `Failed to start backend: ${error.message}`,
      );
      return reject(new Error(`Failed to start backend: ${error.message}`));
    });

    // Handle process exit
    backendProcess.on("close", (code) => {
      logger.backend.info(`Backend process exited with code ${code}`);
      clearTimeout(startupTimer);

      if (code !== 0 && code !== null) {
        let errorMessage = `Backend exited with code ${code}`;

        if (lastBackendError) {
          errorMessage += `\n\n${lastBackendError}`;
        } else {
          errorMessage += "\n\n(No error output captured)";
        }

        dialog.showErrorBox("Backend Crashed", errorMessage);
        lastBackendError = null;
        backendProcess = null;
        return reject(new Error(errorMessage));
      }

      backendProcess = null;
    });

    // If the backend didn't fail in this period of time, resolve the promise
    const startupTimer = setTimeout(() => {
      resolve(backendProcess);
    }, 3000);
  });
}

/**
 * Stops the backend process by sending a SIGTERM and std.in.end() signal.
 * If the process does not exit gracefully after defined time, it will be force killed.
 * @returns {void}
 * @example
 * stopBackend();
 */
async function stopBackend() {
  return new Promise((resolve, reject) => {
    const localBackendProcess = backendProcess;

    // Only stop if process exists and is still running
    if (localBackendProcess && !localBackendProcess.killed) {
      logger.backend.info("Stopping backend...");

      localBackendProcess.once("close", () => {
        // Clear the process reference
        if (localBackendProcess === backendProcess) {
          backendProcess = null;
        }
        resolve();
      });

      localBackendProcess.kill("SIGTERM");
      localBackendProcess.stdin.end();

      const fallbackTimer = setTimeout(() => {
        if (localBackendProcess && !localBackendProcess.killed) {
          logger.backend.warning(
            "Backend did not exit gracefully, force killing...",
          );
          localBackendProcess.kill("SIGKILL");
        }
      }, 2000);

      fallbackTimer.unref();
    } else {
      logger.backend.warning("Backend process not found, skipping stop...");
      resolve();
    }
  });
}

/**
 * Restarts the backend process by stopping the current process and starting a new one.
 * @returns {void}
 * @example
 * restartBackend();
 */
async function restartBackend() {
  // Stop current process first
  await stopBackend();

  // Start a new process
  try {
    await startBackend();
    logger.electron.info("Backend restarted successfully");
  } catch (error) {
    logger.electron.error("Failed to restart backend:", error);
    throw error; // Let the IPC handler know it failed
  }
}

export { restartBackend, startBackend, stopBackend };
