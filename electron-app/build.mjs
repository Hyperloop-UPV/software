#!/usr/bin/env node
/**
 * @file build.mjs
 * @description Build script for the Hyperloop Control Station Electron application.
 * Handles building backend binaries, frontend applications, and managing build artifacts.
 */

import { execSync } from "child_process";
import { mkdirSync, rmSync, cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "./src/utils/logger.js";
import { colors } from "./src/utils/colors.js";

// Get current directory path
const __dirname = dirname(fileURLToPath(import.meta.url));
// Get project root directory (parent of electron-app)
const root = dirname(__dirname);

/**
 * Executes a shell command synchronously with error handling.
 * @param {string} cmd - The command to execute.
 * @param {string} [cwd=root] - Working directory for the command.
 * @param {Object} [env={}] - Additional environment variables to set.
 * @returns {boolean} True if command succeeded, false otherwise.
 * @example
 * const success = run("npm install", "/path/to/project");
 * run("go build", backendDir, { GOOS: "windows", GOARCH: "amd64" });
 */
const run = (cmd, cwd = root, env = {}) => {
  try {
    // Execute command with inherited stdio (shows output)
    execSync(cmd, {
      cwd,
      stdio: "inherit",
      shell: true,
      // Merge process environment with provided env vars
      env: { ...process.env, ...env },
    });
    return true;
  } catch (e) {
    // Log warning if command fails (may need cross-compile tools)
    logger.warning(
      `${cmd.split(" ")[0]} failed (may need cross-compile tools)`
    );
    return false;
  }
};

// Parse command line arguments
const args = process.argv.slice(2);

// Show help message if requested
if (args.includes("--help") || args.includes("-h")) {
  logger.info(`
${colors.bright}${colors.cyan}Hyperloop Control Station Build Script${colors.reset}

${colors.bright}Usage:${colors.reset}
  node build.mjs [options]

${colors.bright}Options:${colors.reset}
  ${colors.green}--platform${colors.reset} P            Specify backend platform (windows, linux, mac, all)
  ${colors.green}--backend${colors.reset}              Build only backends
  ${colors.green}--frontend${colors.reset}             Build only frontends
  ${colors.green}--common-front${colors.reset}         Build common-front library
  ${colors.green}--control-station${colors.reset}      Build control-station frontend
  ${colors.green}--ethernet-view${colors.reset}        Build ethernet-view frontend
  ${colors.green}--help, -h${colors.reset}             Show this help message

${colors.bright}Examples:${colors.reset}
  node build.mjs                         ${colors.dim}# Build everything (all platforms)${colors.reset}
  node build.mjs --platform windows      ${colors.dim}# Build everything for Windows${colors.reset}
  node build.mjs --backend               ${colors.dim}# Build only backends (all platforms)${colors.reset}
  node build.mjs --ethernet-view         ${colors.dim}# Build only ethernet-view${colors.reset}
  ${colors.brightYellow}For npm shortcuts, see package.json scripts section${colors.reset}
`);
  process.exit(0);
}

/**
 * Gets the value of a command line argument flag.
 * @param {string} flag - The flag to look for (e.g., "--platform").
 * @returns {string | null} The value after the flag, or null if not found.
 * @example
 * const platform = getArgValue("--platform");
 * // Returns "windows" if command was: node build.mjs --platform windows
 */
const getArgValue = (flag) => {
  // Find index of the flag
  const idx = args.findIndex((a) => a === flag);
  // Return next argument if flag exists and has a value
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

// Get platform argument value
const platformArg = getArgValue("--platform");

// Check if only --platform is specified (treat as build all for that platform)
const onlyPlatformSpecified =
  platformArg && args.length === 2 && args[0] === "--platform";

// Determine what to build based on arguments
// Build everything if no args or only platform specified
const buildAll = args.length === 0 || onlyPlatformSpecified;
// Build only backend if --backend flag is present
const backendOnly = args.includes("--backend");
// Build only frontend if --frontend flag is present
const frontendOnly = args.includes("--frontend");
// Build common-front if explicitly requested, or if building frontend/all
const buildCommonFront =
  args.includes("--common-front") || frontendOnly || (!backendOnly && buildAll);
// Build control-station if explicitly requested, or if building frontend/all
const buildControlStation =
  args.includes("--control-station") ||
  frontendOnly ||
  (!backendOnly && buildAll);
// Build ethernet-view if explicitly requested, or if building frontend/all
const buildEthernetView =
  args.includes("--ethernet-view") ||
  frontendOnly ||
  (!backendOnly && buildAll);
// Build backend if explicitly requested, or if building all, or if nothing else is being built
const buildBackend =
  backendOnly ||
  (!frontendOnly && buildAll) ||
  (!buildCommonFront && !buildControlStation && !buildEthernetView);

logger.header("🚀 Building Hyperloop Control Station");

// Setup: create necessary directories
mkdirSync(join(__dirname, "binaries"), { recursive: true });
mkdirSync(join(__dirname, "renderer"), { recursive: true });

// Backend build section
if (buildBackend) {
  logger.info("📦 Building backend...");
  // Path to backend source directory
  const backendDir = join(root, "backend/cmd");
  // Path to binaries output directory
  const binDir = join(__dirname, "binaries");

  // Define all supported platforms for cross-compilation
  const allPlatforms = [
    {
      goos: "windows",
      goarch: "amd64",
      out: "backend-windows-amd64.exe",
      name: "windows-amd64",
      alias: "windows",
    },
    {
      goos: "linux",
      goarch: "amd64",
      out: "backend-linux-amd64",
      name: "linux-amd64",
      alias: "linux",
    },
    {
      goos: "darwin",
      goarch: "amd64",
      out: "backend-darwin-amd64",
      name: "darwin-amd64",
      alias: "mac",
    },
    {
      goos: "darwin",
      goarch: "arm64",
      out: "backend-darwin-arm64",
      name: "darwin-arm64",
      alias: "mac",
    },
  ];

  let platforms;

  // Filter platforms based on --platform argument
  if (platformArg) {
    if (platformArg === "all") {
      // Build all platforms
      platforms = allPlatforms;
    } else {
      // Filter to specific platform alias
      platforms = allPlatforms.filter((p) => p.alias === platformArg);
      // Error if platform not found
      if (platforms.length === 0) {
        logger.error(`Unknown platform: ${platformArg}`);
        logger.error(`Available: windows, linux, mac, all`);
        process.exit(1);
      }
    }
  } else {
    // Build all platforms if no platform specified
    platforms = allPlatforms;
  }

  // Build backend for each selected platform
  for (const p of platforms) {
    logger.step(`Building ${colors.magenta}${p.name}${colors.reset}...`);
    // Run go build with platform-specific environment variables
    run(`go build -o "${join(binDir, p.out)}" .`, backendDir, {
      GOOS: p.goos,
      GOARCH: p.goarch,
      CGO_ENABLED: "1",
    });
  }
}

// Frontend - Common library build
if (buildCommonFront) {
  console.log();
  logger.info("📦 Building common-front...");
  logger.step(`Building ${colors.magenta}common-front${colors.reset}...`);
  // Install dependencies
  run("npm ci", join(root, "common-front"));
  // Build the library
  run("npm run build", join(root, "common-front"));
}

// Frontend - Control Station build
if (buildControlStation) {
  console.log();
  logger.info("📦 Building control-station...");
  logger.step(`Building ${colors.magenta}control-station${colors.reset}...`);
  // Install dependencies
  run("npm ci", join(root, "control-station"));
  // Build the application
  run("npm run build", join(root, "control-station"));

  logger.step("Copying static files...");
  // Remove existing renderer directory
  rmSync(join(__dirname, "renderer/control-station"), {
    recursive: true,
    force: true,
  });
  // Copy built static files to renderer directory
  cpSync(
    join(root, "control-station/static"),
    join(__dirname, "renderer/control-station"),
    { recursive: true }
  );
}

// Frontend - Ethernet View build
if (buildEthernetView) {
  console.log();
  logger.info("📦 Building ethernet-view...");
  logger.step(`Building ${colors.magenta}ethernet-view${colors.reset}...`);
  // Install dependencies
  run("npm ci", join(root, "ethernet-view"));
  // Build the application
  run("npm run build", join(root, "ethernet-view"));

  logger.step("Copying static files...");
  // Remove existing renderer directory
  rmSync(join(__dirname, "renderer/ethernet-view"), {
    recursive: true,
    force: true,
  });
  // Copy built static files to renderer directory
  cpSync(
    join(root, "ethernet-view/static"),
    join(__dirname, "renderer/ethernet-view"),
    { recursive: true }
  );
}

// Install Electron dependencies if any frontend was built
if (buildControlStation || buildEthernetView) {
  console.log();
  logger.info("📦 Installing Electron dependencies...");
  // Install Electron app dependencies
  run("npm ci", __dirname);
}

console.log();
logger.success("✅ Build complete!");
console.log();
// Show helpful next steps
console.log(
  `${colors.dim}To run in development: ${colors.reset}${colors.cyan}npm start${colors.reset}`
);
console.log(
  `${colors.dim}To build installers: ${colors.reset}${colors.cyan}npm run dist${colors.reset}`
);
console.log();
