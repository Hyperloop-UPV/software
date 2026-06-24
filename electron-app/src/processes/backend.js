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
import { formatBackendError, getHint } from "./backendError.js";

// Create ANSI to HTML converter
const convert = new AnsiToHtml();

// Get the application root path
const appPath = getAppPath();

// Store the backend process instance
let backendProcess = null;

// Common log window instance for all backend processes
let storedLogWindow = null;

// Store error messages accumulated from the current process run
let lastBackendError = null;

/**
 * Clears the stored log window reference and closes it
 */
function clearLogWindow() {
  if (storedLogWindow && !storedLogWindow.isDestroyed()) {
    try {
      storedLogWindow.close();
    } catch (e) {}
  }
  storedLogWindow = null;
}

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
    let resolved = false;

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
      const text = data.toString().trim();
      logger.backend.info(text);

      // Send log message to log window
      if (
        currentLogWindow &&
        !currentLogWindow.isDestroyed() &&
        currentLogWindow.webContents
      ) {
        const htmlData = convert.toHtml(text);
        currentLogWindow.webContents.send("log", htmlData);
      }

      // Resolve as soon as the HTTP server confirms it is listening.
      // Matches: "INF ... > http server listening localAddr=..."
      if (text.includes("http server listening") && !resolved) {
        logger.backend.info("Backend ready (HTTP server listening)");
        clearTimeout(startupTimer);
        resolved = true;
        resolve(backendProcess);
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
      if (!resolved) {
        resolved = true;
        return reject(new Error(`Failed to start backend: ${error.message}`));
      }
    });

    // Handle process exit
    backendProcess.on("close", (code) => {
      logger.backend.info(`Backend process exited with code ${code}`);
      clearTimeout(startupTimer);

      // If the process closed without success, reject the promise
      if (!resolved) {
        if (code !== 0 && code !== null) {
          let errorMessage = `Backend exited with code ${code}`;

          if (lastBackendError) {
            const stripped = lastBackendError.replace(/\x1b\[[0-9;]*m/g, "");
            const formatted = formatBackendError(stripped);
            errorMessage += `\n\n${getHint(stripped, formatted)}`;
          } else {
            errorMessage += "\n\n(No error output captured)";
          }

          dialog.showErrorBox("Backend Crashed", errorMessage);
          lastBackendError = null;
          backendProcess = null;
          resolved = true;
          return reject(new Error(errorMessage));
        }

        if (code === null || code === 0) {
          let errorMessage = "Backend process closed before initialization completed";
          if (lastBackendError) {
            const stripped = lastBackendError.replace(/\x1b\[[0-9;]*m/g, "");
            errorMessage += `\n\n${stripped}`;
            lastBackendError = null;
          }
          logger.backend.warning(errorMessage);
          dialog.showErrorBox("Backend Failed to Start", errorMessage);
          backendProcess = null;
          resolved = true;
          return reject(new Error(errorMessage));
        }
      }

      backendProcess = null;
    });

    // Fallback: if the ready message never appears, resolve anyway after timeout
    const startupTimer = setTimeout(() => {
      if (!resolved) {
        logger.backend.warning(
          "Backend ready signal not received - resolving after timeout",
        );
        resolved = true;
        resolve(backendProcess);
      }
    }, 5000);
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
        // Clean up log window
        clearLogWindow();
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
      // Clean up log window even if process doesn't exist
      clearLogWindow();
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
  await stopBackend();
  // Brief pause so the OS fully releases ports before the new process binds them
  await new Promise((resolve) => setTimeout(resolve, 500));
  try {
    await startBackend();
    logger.electron.info("Backend restarted successfully");
  } catch (error) {
    logger.electron.error("Failed to restart backend:", error);
    throw error;
  }
}

function getBackendWorkingDir() {
  return !app.isPackaged
    ? path.join(appPath, "..", "backend", "cmd")
    : path.dirname(getUserConfigPath());
}

export { clearLogWindow, getBackendWorkingDir, restartBackend, startBackend, stopBackend };
