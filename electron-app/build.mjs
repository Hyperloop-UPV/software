#!/usr/bin/env node
import { execSync } from "child_process";
import { mkdirSync, rmSync, cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "./src/utils/logger.js";
import { colors } from "./src/utils/colors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = dirname(__dirname);

const run = (cmd, cwd = root, env = {}) => {
  try {
    execSync(cmd, {
      cwd,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...env },
    });
    return true;
  } catch (e) {
    logger.warning(
      `${cmd.split(" ")[0]} failed (may need cross-compile tools)`
    );
    return false;
  }
};

// Parse arguments
const args = process.argv.slice(2);

// Show help
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

const getArgValue = (flag) => {
  const idx = args.findIndex((a) => a === flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const platformArg = getArgValue("--platform");

// Check if only --platform is specified (treat as build all for that platform)
const onlyPlatformSpecified =
  platformArg && args.length === 2 && args[0] === "--platform";

const buildAll = args.length === 0 || onlyPlatformSpecified;
const backendOnly = args.includes("--backend");
const frontendOnly = args.includes("--frontend");
const buildCommonFront =
  args.includes("--common-front") || frontendOnly || (!backendOnly && buildAll);
const buildControlStation =
  args.includes("--control-station") ||
  frontendOnly ||
  (!backendOnly && buildAll);
const buildEthernetView =
  args.includes("--ethernet-view") ||
  frontendOnly ||
  (!backendOnly && buildAll);
const buildBackend =
  backendOnly ||
  (!frontendOnly && buildAll) ||
  (!buildCommonFront && !buildControlStation && !buildEthernetView);

logger.header("🚀 Building Hyperloop Control Station");

// Setup
mkdirSync(join(__dirname, "binaries"), { recursive: true });
mkdirSync(join(__dirname, "renderer"), { recursive: true });

// Backend
if (buildBackend) {
  logger.info("📦 Building backend...");
  const backendDir = join(root, "backend/cmd");
  const binDir = join(__dirname, "binaries");

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

  if (platformArg) {
    if (platformArg === "all") {
      platforms = allPlatforms;
    } else {
      platforms = allPlatforms.filter((p) => p.alias === platformArg);
      if (platforms.length === 0) {
        logger.error(`Unknown platform: ${platformArg}`);
        logger.error(`Available: windows, linux, mac, all`);
        process.exit(1);
      }
    }
  } else {
    platforms = allPlatforms;
  }

  for (const p of platforms) {
    logger.step(`Building ${colors.magenta}${p.name}${colors.reset}...`);
    run(`go build -o "${join(binDir, p.out)}" .`, backendDir, {
      GOOS: p.goos,
      GOARCH: p.goarch,
      CGO_ENABLED: "1",
    });
  }
}

// Frontend - Common
if (buildCommonFront) {
  console.log();
  logger.info("📦 Building common-front...");
  logger.step(`Building ${colors.magenta}common-front${colors.reset}...`);
  run("npm install", join(root, "common-front"));
  run("npm run build", join(root, "common-front"));
}

// Frontend - Control Station
if (buildControlStation) {
  console.log();
  logger.info("📦 Building control-station...");
  logger.step(`Building ${colors.magenta}control-station${colors.reset}...`);
  run("npm install", join(root, "control-station"));
  run("npm run build", join(root, "control-station"));

  logger.step("Copying static files...");
  rmSync(join(__dirname, "renderer/control-station"), {
    recursive: true,
    force: true,
  });
  cpSync(
    join(root, "control-station/static"),
    join(__dirname, "renderer/control-station"),
    { recursive: true }
  );
}

// Frontend - Ethernet View
if (buildEthernetView) {
  console.log();
  logger.info("📦 Building ethernet-view...");
  logger.step(`Building ${colors.magenta}ethernet-view${colors.reset}...`);
  run("npm install", join(root, "ethernet-view"));
  run("npm run build", join(root, "ethernet-view"));

  logger.step("Copying static files...");
  rmSync(join(__dirname, "renderer/ethernet-view"), {
    recursive: true,
    force: true,
  });
  cpSync(
    join(root, "ethernet-view/static"),
    join(__dirname, "renderer/ethernet-view"),
    { recursive: true }
  );
}

// Install Electron deps if any frontend was built
if (buildControlStation || buildEthernetView) {
  console.log();
  logger.info("📦 Installing Electron dependencies...");
  run("npm install", __dirname);
}

console.log();
logger.success("✅ Build complete!");
console.log();
console.log(
  `${colors.dim}To run in development: ${colors.reset}${colors.cyan}npm start${colors.reset}`
);
console.log(
  `${colors.dim}To build installers: ${colors.reset}${colors.cyan}npm run dist${colors.reset}`
);
console.log();
