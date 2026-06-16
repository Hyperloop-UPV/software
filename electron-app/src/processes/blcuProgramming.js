import { spawn } from "child_process";
import { app, dialog } from "electron";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";
import { getAppPath, getBinaryPath } from "../utils/paths.js";

let blcuProgrammingProcess = null;

function getBlcuProgrammingRepoPath() {
  return path.join(getAppPath(), "..", "blcu-programming");
}

function getPythonExecutable(repoPath) {
  if (process.platform === "win32") {
    return path.join(repoPath, ".venv", "Scripts", "python.exe");
  }

  return path.join(repoPath, ".venv", "bin", "python");
}

function getBlcuProgrammingWorkingDir() {
  if (!app.isPackaged) {
    return getBlcuProgrammingRepoPath();
  }

  const workingDir = path.join(app.getPath("userData"), "blcu-programming");
  fs.mkdirSync(workingDir, { recursive: true });
  return workingDir;
}

function getBinaryStartConfig() {
  const binaryPath = getBinaryPath("blcu-programming");

  if (!fs.existsSync(binaryPath)) {
    return null;
  }

  return {
    command: binaryPath,
    args: [],
    cwd: getBlcuProgrammingWorkingDir(),
    source: "binary",
  };
}

function getPythonStartConfig() {
  const repoPath = getBlcuProgrammingRepoPath();
  const pythonBin = getPythonExecutable(repoPath);
  const entrypointPath = path.join(repoPath, "api", "main.py");

  if (!fs.existsSync(entrypointPath)) {
    logger.process(
      "BLCU Programming",
      `Entrypoint not found at ${entrypointPath}`,
    );
    return null;
  }

  if (!fs.existsSync(pythonBin)) {
    logger.process(
      "BLCU Programming",
      `Python executable not found at ${pythonBin}`,
    );
    return null;
  }

  return {
    command: pythonBin,
    args: ["-m", "api.main"],
    cwd: repoPath,
    source: "python",
  };
}

function getStartConfig() {
  return (
    getBinaryStartConfig() || (!app.isPackaged ? getPythonStartConfig() : null)
  );
}

async function startBlcuProgramming() {
  if (blcuProgrammingProcess && !blcuProgrammingProcess.killed) {
    return blcuProgrammingProcess;
  }

  const startConfig = getStartConfig();

  if (!startConfig) {
    const message =
      "BLCU programming executable not found. Run the Electron build before packaging the release.";

    logger.process("BLCU Programming", message);

    if (app.isPackaged) {
      dialog.showErrorBox("BLCU Programming Error", message);
    }

    return null;
  }

  logger.process(
    "BLCU Programming",
    `Starting ${startConfig.source}: ${startConfig.command}`,
  );

  blcuProgrammingProcess = spawn(startConfig.command, startConfig.args, {
    cwd: startConfig.cwd,
    env: {
      ...process.env,
      BLCU_API_HOST: process.env.BLCU_API_HOST || "127.0.0.1",
      BLCU_API_PORT: process.env.BLCU_API_PORT || "8000",
      PYTHONUNBUFFERED: "1",
    },
  });

  blcuProgrammingProcess.stdout.on("data", (data) => {
    logger.process("BLCU Programming", data.toString().trim());
  });

  blcuProgrammingProcess.stderr.on("data", (data) => {
    logger.process("BLCU Programming", data.toString().trim());
  });

  blcuProgrammingProcess.on("error", (error) => {
    logger.process(
      "BLCU Programming",
      `Failed to start BLCU programming: ${error.message}`,
    );
    blcuProgrammingProcess = null;
  });

  blcuProgrammingProcess.on("close", (code) => {
    logger.process("BLCU Programming", `Process exited with code ${code}`);
    blcuProgrammingProcess = null;
  });

  return blcuProgrammingProcess;
}

async function stopBlcuProgramming() {
  if (!blcuProgrammingProcess || blcuProgrammingProcess.killed) {
    return;
  }

  blcuProgrammingProcess.kill("SIGTERM");
  blcuProgrammingProcess = null;
}

export { startBlcuProgramming, stopBlcuProgramming };
