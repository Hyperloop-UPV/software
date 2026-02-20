/**
 * @module utils
 * @description Path utility functions for resolving application and resource paths.
 * Handles path resolution for both development and production environments.
 */

import { app } from "electron";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Gets the application root path (electron-app directory).
 * @returns {string} The absolute path to the application root directory.
 * @example
 * const appPath = getAppPath();
 * console.log(`App is located at: ${appPath}`);
 */
function getAppPath() {
  if (!app.isPackaged) {
    // Development: electron-app directory is 2 levels up from src/utils/paths.js
    return path.join(__dirname, "..", "..");
  }
  // Production: use app.getAppPath() which points to the app root
  return app.getAppPath();
}

/**
 * Gets the path to a platform-specific binary executable.
 * @param {string} name - The name of the binary (without extension or platform suffix).
 * @returns {string} The absolute path to the binary executable file.
 * @example
 * const backendPath = getBinaryPath("backend");
 * // Development: returns path like "electron-app/binaries/backend-windows-amd64.exe"
 * // Production: returns path like "resources/binaries/backend-windows-amd64.exe"
 */
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

/**
 * Gets the path to the user configuration file.
 * @returns {string} The absolute path to the user's config.toml file.
 * @example
 * const configPath = getUserConfigPath();
 * // Development: returns "electron-app/config.toml"
 * // Production: returns "userData/configs/config.toml"
 */
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

/**
 * Gets the path to the configuration template file.
 * @returns {string} The absolute path to the configuration template file.
 * @example
 * const templatePath = getTemplatePath();
 * // Development: returns "../backend/cmd/dev-config.toml"
 * // Production: returns "resources/config.toml"
 */
function getTemplatePath() {
  if (!app.isPackaged) {
    // Development: use backend config.toml as template
    return path.join(getAppPath(), "..", "backend", "cmd", "dev-config.toml");
  }

  // Production: default config.toml is bundled in resources
  return path.join(process.resourcesPath, "config.toml");
}

export { getAppPath, getBinaryPath, getTemplatePath, getUserConfigPath };
