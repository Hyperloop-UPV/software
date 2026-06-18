#!/usr/bin/env node
/**
 * @file build.mjs
 * @description Modular build script for Hyperloop Control Station
 */

import { execSync } from "child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { logger } from "./src/utils/logger.js";

// --- Configuration ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);

const CONFIG = {
  backend: {
    type: "go",
    path: join(ROOT, "backend"), // Root of backend (where package.json is)
    output: join(__dirname, "binaries"),
    entry: "./cmd",
    commands: ["pnpm run build:ci"],
    platforms: [
      {
        id: "win64",
        goos: "windows",
        goarch: "amd64",
        ext: ".exe",
        tags: ["win", "windows"],
      },
      {
        id: "linux64",
        goos: "linux",
        goarch: "amd64",
        ext: "",
        tags: ["linux"],
      },
      {
        id: "mac64",
        goos: "darwin",
        goarch: "amd64",
        ext: "",
        tags: ["mac", "macos"],
      },
      {
        id: "macArm",
        goos: "darwin",
        goarch: "arm64",
        ext: "",
        tags: ["mac", "macos"],
      },
    ],
  },
  "blcu-programming": {
    type: "python",
    path: join(ROOT, "blcu-programming"),
    output: join(__dirname, "binaries"),
    entry: join(ROOT, "blcu-programming", "api", "main.py"),
    requirements: join(ROOT, "blcu-programming", "requirements-build.txt"),
    venv: join(ROOT, "blcu-programming", ".venv-build"),
  },
  "testing-view": {
    type: "frontend",
    path: join(ROOT, "frontend/testing-view"),
    dest: join(__dirname, "renderer/testing-view"),
    commands: [
      "pnpm --filter testing-view install --frozen-lockfile",
      "pnpm run build",
    ],
  },
  "competition-view": {
    type: "frontend",
    path: join(ROOT, "frontend/competition-view"),
    dest: join(__dirname, "renderer/competition-view"),
    commands: [
      "pnpm --filter competition-view install --frozen-lockfile",
      "pnpm run build",
    ],
    optional: true,
  },
  "flashing-view": {
    type: "frontend",
    path: join(ROOT, "frontend/flashing-view"),
    dest: join(__dirname, "renderer/flashing-view"),
    commands: [
      "pnpm --filter flashing-view install --frozen-lockfile",
      "pnpm run build",
    ],
  },
};

// --- Helpers ---

const run = (cmd, cwd, env = {}) => {
  try {
    const finalEnv = { ...process.env, ...env };
    execSync(cmd, { cwd, stdio: "inherit", shell: true, env: finalEnv });
    return true;
  } catch (e) {
    logger.error(`Command failed: ${cmd}`);
    return false;
  }
};

const buildGo = (name, config, requestedPlatforms, extraArgs = "") => {
  logger.info(`Building ${name} (Go)...`);
  mkdirSync(config.output, { recursive: true });

  const targets = config.platforms.filter((p) => {
    if (
      !requestedPlatforms ||
      requestedPlatforms.length === 0 ||
      requestedPlatforms.includes("all")
    )
      return true;
    return p.tags.some((tag) => requestedPlatforms.includes(tag));
  });

  let success = true;
  for (const p of targets) {
    const filename = `${name}-${p.goos}-${p.goarch}${p.ext}`;
    logger.step(`Building ${p.goos}/${p.goarch}...`);

    const entryPath = config.entry || ".";

    for (const cmd of config.commands) {
      const buildCmd = `${cmd} -o "${join(config.output, filename)}" ${extraArgs} ${entryPath}`;

      const result = run(buildCmd, config.path, {
        GOOS: p.goos,
        GOARCH: p.goarch,
        CGO_ENABLED: "1",
      });

      if (!result) {
        logger.warning(`Failed to build ${filename}`);
        success = false;
        break;
      }
    }
  }
  return success;
};

const getVenvPython = (venvPath) => {
  const binDir = process.platform === "win32" ? "Scripts" : "bin";
  const executable = process.platform === "win32" ? "python.exe" : "python";
  return join(venvPath, binDir, executable);
};

const createPythonVenv = (venvPath, cwd) => {
  if (existsSync(getVenvPython(venvPath))) return true;

  const python = process.env.PYTHON || "python";

  logger.step(`Creating Python build venv with ${python}...`);
  return run(`${python} -m venv "${venvPath}"`, cwd);
};

const getPythonTarget = () => {
  const goos =
    { win32: "windows", darwin: "darwin", linux: "linux" }[process.platform] ||
    process.platform;
  const goarch = { x64: "amd64", arm64: "arm64" }[process.arch] || process.arch;
  const platformTag =
    { win32: "win", darwin: "mac", linux: "linux" }[process.platform] ||
    process.platform;

  return {
    binarySuffix: `${goos}-${goarch}${process.platform === "win32" ? ".exe" : ""}`,
    label: `${goos}/${goarch}`,
    platformTag,
  };
};

const buildPython = (name, config, requestedPlatforms) => {
  const target = getPythonTarget();
  const targetRequested =
    requestedPlatforms.length === 0 ||
    requestedPlatforms.includes("all") ||
    requestedPlatforms.includes(target.platformTag);

  if (!targetRequested) {
    logger.error(
      `${name} must be built on the target OS because PyInstaller cannot cross-compile. Current host is ${target.label}.`,
    );
    return false;
  }

  logger.info(`Building ${name} (Python/PyInstaller)...`);
  mkdirSync(config.output, { recursive: true });

  if (!createPythonVenv(config.venv, config.path)) return false;

  const pythonBin = getVenvPython(config.venv);

  if (
    !run(
      `"${pythonBin}" -m pip install -r "${config.requirements}"`,
      config.path,
    )
  ) {
    return false;
  }

  const binaryName = `${name}-${target.binarySuffix}`;
  const binaryBaseName = binaryName.replace(/\.exe$/, "");
  const binaryPath = join(config.output, binaryName);
  const pyinstallerWorkPath = join(config.path, "build", "pyinstaller");
  const pyinstallerSpecPath = join(config.path, "build");

  if (existsSync(binaryPath)) {
    try {
      rmSync(binaryPath, { force: true });
    } catch (error) {
      if (error.code === "EPERM" || error.code === "EACCES") {
        logger.error(
          `Could not replace ${binaryPath}. Stop Electron or the running BLCU programming process, then build again.`,
        );
        return false;
      }

      throw error;
    }
  }

  return run(
    [
      `"${pythonBin}" -m PyInstaller`,
      "--clean",
      "--noconfirm",
      "--onefile",
      `--name "${binaryBaseName}"`,
      `--distpath "${config.output}"`,
      `--workpath "${pyinstallerWorkPath}"`,
      `--specpath "${pyinstallerSpecPath}"`,
      "--hidden-import uvicorn.loops.auto",
      "--hidden-import uvicorn.protocols.http.auto",
      "--hidden-import uvicorn.lifespan.on",
      `"${config.entry}"`,
    ].join(" "),
    config.path,
  );
};

const buildFrontend = (name, config, extraArgs = "") => {
  if (config.optional && !existsSync(join(config.path, "package.json"))) {
    logger.warning(`Skipping ${name} (not initialized)`);
    return true;
  }

  logger.info(`Building ${name}...`);

  for (const cmd of config.commands) {
    const finalCmd = cmd.includes("build") ? `${cmd} ${extraArgs}` : cmd;
    if (!run(finalCmd, config.path)) return false;
  }

  logger.step(`Copying to renderer/${name}...`);
  if (existsSync(config.dest))
    rmSync(config.dest, { recursive: true, force: true });

  const distPath = join(config.path, "dist");
  if (existsSync(distPath)) {
    cpSync(distPath, config.dest, { recursive: true });
    return true;
  } else {
    logger.error(`Build output not found at ${distPath}`);
    return false;
  }
};

// --- Argument Parsing ---

const args = process.argv.slice(2);
const doubleDashIndex = args.indexOf("--");
const scriptArgs =
  doubleDashIndex !== -1 ? args.slice(0, doubleDashIndex) : args;
const extraArgs =
  doubleDashIndex !== -1 ? args.slice(doubleDashIndex + 1).join(" ") : "";

const requestedPlatforms = [];
if (scriptArgs.includes("--win") || scriptArgs.includes("--windows"))
  requestedPlatforms.push("win");
if (scriptArgs.includes("--linux")) requestedPlatforms.push("linux");
if (scriptArgs.includes("--mac") || scriptArgs.includes("--macos"))
  requestedPlatforms.push("mac");
if (scriptArgs.includes("--all")) requestedPlatforms.push("all");

// Handle Overrides: --target.prop=value
scriptArgs.forEach((arg) => {
  if (arg.startsWith("--") && arg.includes(".") && arg.includes("=")) {
    const [key, value] = arg.slice(2).split("=");
    const [target, prop] = key.split(".");
    if (CONFIG[target] && prop) {
      const finalValue = prop === "commands" ? value.split(",") : value;
      CONFIG[target][prop] = finalValue;
      logger.info(`Override: ${target}.${prop} = ${finalValue}`);
    }
  }
});

const specificTargets = Object.keys(CONFIG).filter((key) =>
  scriptArgs.includes(`--${key}`),
);
const targetsToBuild =
  specificTargets.length > 0 ? specificTargets : Object.keys(CONFIG);

// --- Main Execution ---

console.log(`
______  __                           ______                         _____  ____________    __
___  / / /____  ________________________  /___________________      __  / / /__  __ \\_ |  / /
__  /_/ /__  / / /__  __ \\  _ \\_  ___/_  /_  __ \\  __ \\__  __ \\     _  / / /__  /_/ /_ | / / 
_  __  / _  /_/ /__  /_/ /  __/  /   _  / / /_/ / /_/ /_  /_/ /     / /_/ / _  ____/__ |/ /  
/_/ /_/  _\\__, / _  .___/\\___//_/    /_/  \\____/\\____/_  .___/      \\____/  /_/     _____/   
         /____/  /_/                                  /_/                                    `);

logger.header("Hyperloop Control Station Build");

(async () => {
  let frontendBuilt = false;
  let allSuccess = true;

  for (const key of targetsToBuild) {
    const config = CONFIG[key];
    let success = true;

    if (config.type === "go") {
      success = buildGo(key, config, requestedPlatforms, extraArgs);
    } else if (config.type === "python") {
      success = buildPython(key, config, requestedPlatforms);
    } else if (config.type === "frontend") {
      success = buildFrontend(key, config, extraArgs);
      if (success && !config.optional) frontendBuilt = true;
    }

    if (!success) {
      allSuccess = false;
      if (process.env.CI) process.exit(1);
    }
  }

  if (frontendBuilt && !process.env.CI) {
    logger.info("Finalizing Electron...");
    run(
      "pnpm --filter hyperloop-control-station install --frozen-lockfile",
      __dirname,
    );
  }

  if (allSuccess) {
    logger.success("Build complete!");
  } else {
    logger.error("Build failed.");
    process.exit(1);
  }
})();
