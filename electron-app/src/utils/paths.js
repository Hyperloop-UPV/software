import { app } from "electron";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
      __dirname,
      "..",
      "..",
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
    return path.join(__dirname, "..", "..", "config.toml");
  }

  // Production: user config in userData directory
  const userConfigDir = app.getPath("userData");
  const configsDir = path.join(userConfigDir, "configs");
  return path.join(configsDir, "config.toml");
}

function getTemplatePath() {
  if (!app.isPackaged) {
    // Development: use backend config.toml as template
    return path.join(
      __dirname,
      "..",
      "..",
      "..",
      "backend",
      "cmd",
      "dev-config.toml"
    );
  }

  // Production: default config.toml is bundled in resources
  return path.join(process.resourcesPath, "config.toml");
}

export { getBinaryPath, getUserConfigPath, getTemplatePath };
