import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";
import { getAppPath } from "../utils/paths.js";

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

async function startBlcuProgramming() {
  if (blcuProgrammingProcess && !blcuProgrammingProcess.killed) {
    return blcuProgrammingProcess;
  }

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

  blcuProgrammingProcess = spawn(
    pythonBin,
    ["-m", "uvicorn", "api.main:app"],
    {
      cwd: repoPath,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    },
  );

  blcuProgrammingProcess.stdout.on("data", (data) => {
    logger.process("BLCU Programming", data.toString().trim());
  });

  blcuProgrammingProcess.stderr.on("data", (data) => {
    logger.process("BLCU Programming", data.toString().trim());
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
