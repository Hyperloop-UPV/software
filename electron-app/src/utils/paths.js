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
      `${name}-${goos}-${goarch}${ext}`,
    );
  }

  return path.join(
    process.resourcesPath,
    "binaries",
    `${name}-${goos}-${goarch}${ext}`,
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

/** Working directory passed to the Go backend; relative logging paths use it. */
function getBackendWorkingDir() {
  return !app.isPackaged
    ? path.join(getAppPath(), "..", "backend", "cmd")
    : path.dirname(getUserConfigPath());
}

/** Match os.UserCacheDir and filepath.Abs in backend/pkg/adj/adj.go. */
function getBackendCachePath({
  platform = process.platform,
  env = process.env,
} = {}) {
  const platformPath = platform === "win32" ? path.win32 : path.posix;
  let cacheDir;
  if (platform === "win32") {
    cacheDir = env.LocalAppData || env.LOCALAPPDATA;
  } else if (platform === "darwin") {
    if (env.HOME) cacheDir = platformPath.join(env.HOME, "Library", "Caches");
  } else {
    if (env.XDG_CACHE_HOME && !platformPath.isAbsolute(env.XDG_CACHE_HOME)) {
      throw new Error(
        "The Go backend requires an absolute XDG_CACHE_HOME path.",
      );
    }
    cacheDir =
      env.XDG_CACHE_HOME || (env.HOME && platformPath.join(env.HOME, ".cache"));
  }
  if (!cacheDir)
    throw new Error("The Go backend's user cache directory is not configured.");
  return platformPath.resolve(
    getBackendWorkingDir(),
    cacheDir,
    "hyperloop-control-station",
  );
}

/**
 * Gets the path to the user app version file.
 * @returns {string} The absolute path to the user's version.toml file.
 * @example
 * const configVersionPath = getVersionFilePath();
 * // Development: returns "electron-app/version.toml"
 * // Production: returns "userData/configs/version.toml"
 */
function getVersionFilePath() {
  if (!app.isPackaged) {
    // Development: use local version.toml in project root
    return path.join(getAppPath(), "version.toml");
  }

  // Production: user version in userData directory
  const userConfigDir = app.getPath("userData");
  return path.join(userConfigDir, "version.toml");
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

export {
  getAppPath,
  getBinaryPath,
  getBackendCachePath,
  getBackendWorkingDir,
  getTemplatePath,
  getUserConfigPath,
  getVersionFilePath,
};
