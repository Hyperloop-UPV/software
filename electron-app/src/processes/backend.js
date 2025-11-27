import { spawn } from "child_process";
import { dialog } from "electron";
import { getBinaryPath, getUserConfigPath } from "../utils/paths.js";
import fs from "fs";
import { app } from "electron";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let backendProcess = null;

function startBackend() {
  const backendBin = getBinaryPath("backend");
  const configPath = getUserConfigPath();

  if (!fs.existsSync(backendBin)) {
    console.error(`Backend binary not found: ${backendBin}`);
    dialog.showErrorBox("Error", `Backend binary not found at: ${backendBin}`);
    return;
  }

  console.log(`Starting backend: ${backendBin}, config: ${configPath}`);

  // Set working directory to backend/cmd in development, or resources in production
  const workingDir = !app.isPackaged
    ? path.join(__dirname, "..", "..", "..", "backend", "cmd")
    : path.dirname(configPath);

  backendProcess = spawn(backendBin, ["--config", configPath], {
    cwd: workingDir,
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });

  backendProcess.on("error", (error) => {
    console.error(`Failed to start backend: ${error.message}`);
    dialog.showErrorBox(
      "Backend Error",
      `Failed to start backend: ${error.message}`
    );
  });

  backendProcess.on("close", (code) => {
    console.log(`Backend process exited with code ${code}`);
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
    console.log("Stopping backend...");
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
}

function restartBackend() {
  stopBackend();
  startBackend();
}

export { startBackend, stopBackend, restartBackend };
