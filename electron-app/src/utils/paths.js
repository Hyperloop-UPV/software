import { app } from "electron";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the app root path (electron-app directory)
 * Works correctly in both development and production
 */
function getAppPath() {
  if (!app.isPackaged) {
    // Development: electron-app directory is 2 levels up from src/utils/paths.js
    return path.join(__dirname, "..", "..");
  }
  // Production: use app.getAppPath() which points to the app root
  return app.getAppPath();
}

function getBinaryPath(name) {
  const platform = process.platform;
  const arch = process.arch;
  const ext = platform === "win32" ? ".exe" : "";

  const goosMap = {
    win32: "windows",
    darwin: "darwin",
    linux: "linux",
  };

  const goarchMap = {
    x64: "amd64",
    arm64: "arm64",
  };

  const goos = goosMap[platform] || platform;
  const goarch = goarchMap[arch] || arch;

  if (!app.isPackaged) {
    return path.join(
      getAppPath(),
      "binaries",
      `${name}-${goos}-${goarch}${ext}`
    );
  }

  return path.join(
    process.resourcesPath,
    "binaries",
    `${name}-${goos}-${goarch}${ext}`
  );
}

function getUserConfigPath() {
  if (!app.isPackaged) {
    // Development: use local config.toml in project root
    return path.join(getAppPath(), "config.toml");
  }

  // Production: user config in userData directory
  const userConfigDir = app.getPath("userData");
  const configsDir = path.join(userConfigDir, "configs");
  return path.join(configsDir, "config.toml");
}

function getTemplatePath() {
  if (!app.isPackaged) {
    // Development: use backend config.toml as template
    return path.join(getAppPath(), "..", "backend", "cmd", "dev-config.toml");
  }

  // Production: default config.toml is bundled in resources
  return path.join(process.resourcesPath, "config.toml");
}

export { getAppPath, getBinaryPath, getUserConfigPath, getTemplatePath };
