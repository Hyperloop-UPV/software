#!/usr/bin/env node
/**
 * @file build.mjs
 * @description Modular build script for Hyperloop Control Station
 */

import { execSync } from "child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "fs";
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
  "packet-sender": {
    type: "rust",
    path: join(ROOT, "packet-sender"),
    output: join(__dirname, "binaries"),
    commands: ["pnpm install --frozen-lockfile", "pnpm run build"],
    binaryPath: "target/release/packet-sender",
    platforms: [
      { id: "win64", ext: ".exe", tags: ["win", "windows"] },
      { id: "linux64", ext: "", tags: ["linux"] },
      { id: "mac64", ext: "", tags: ["mac", "macos"] },
    ],
  },
  "testing-view": {
    type: "frontend",
    path: join(ROOT, "frontend/testing-view"),
    dest: join(__dirname, "renderer/testing-view"),
    commands: ["pnpm install --frozen-lockfile", "pnpm run build"],
  },
  "competition-view": {
    type: "frontend",
    path: join(ROOT, "frontend/competition-view"),
    dest: join(__dirname, "renderer/competition-view"),
    commands: ["pnpm install --frozen-lockfile", "pnpm run build"],
    optional: true,
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

const buildBackend = (config, requestedPlatforms, extraArgs = "") => {
  logger.info("Building Backend (Go)...");
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

  if (targets.length === 0) {
    logger.error(
      `No matching platforms found for: ${requestedPlatforms.join(", ")}`
    );
    return false;
  }

  let success = true;
  for (const p of targets) {
    const filename = `backend-${p.goos}-${p.goarch}${p.ext}`;
    logger.step(`Building ${p.goos}/${p.goarch}...`);

    for (const cmd of config.commands) {
      // cmd is like "pnpm run build:ci --"
      // We append the output flag and target directory
      const buildCmd = `${cmd} -o "${join(config.output, filename)}" ${extraArgs} ./cmd`;

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

const buildRust = (name, config, requestedPlatforms, extraArgs = "") => {
  logger.info(`Building ${name} (Rust)...`);
  mkdirSync(config.output, { recursive: true });

  for (const cmd of config.commands) {
    // Only append extra args to build commands
    const finalCmd = cmd.includes("build") ? `${cmd} ${extraArgs}` : cmd;
    if (!run(finalCmd, config.path)) return false;
  }

  const isWin =
    process.platform === "win32" ||
    (requestedPlatforms && requestedPlatforms.includes("win"));
  const ext = isWin ? ".exe" : "";

  // Check for source binary
  const sourceBin = join(config.path, config.binaryPath + ext);
  const destName = `packet-sender${ext}`;
  const destPath = join(config.output, destName);

  logger.step(`Copying binary to ${destPath}...`);

  if (existsSync(sourceBin)) {
    copyFileSync(sourceBin, destPath);
    return true;
  } else {
    logger.error(`Rust binary not found at ${sourceBin}`);
    return false;
  }
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
  scriptArgs.includes(`--${key}`)
);
const targetsToBuild =
  specificTargets.length > 0 ? specificTargets : Object.keys(CONFIG);

// --- Main Execution ---

logger.header("Hyperloop Control Station Build");

(async () => {
  let frontendBuilt = false;
  let allSuccess = true;

  for (const key of targetsToBuild) {
    const config = CONFIG[key];
    let success = true;

    if (config.type === "go") {
      success = buildBackend(config, requestedPlatforms, extraArgs);
    } else if (config.type === "rust") {
      success = buildRust(key, config, requestedPlatforms, extraArgs);
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
    run("pnpm install --frozen-lockfile", __dirname);
  }

  if (allSuccess) {
    logger.success("Build complete!");
  } else {
    logger.error("Build failed.");
    process.exit(1);
  }
})();
