const { app } = require("electron");
const path = require("path");

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

function getConfigPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, "..", "..", "config.toml");
  }

  const userConfigDir = app.getPath("userData");
  const configsDir = path.join(userConfigDir, "configs");
  const configPath = path.join(configsDir, "config.toml");

  if (!require("fs").existsSync(configPath)) {
    const defaultConfigPath = path.join(process.resourcesPath, "config.toml");
    if (require("fs").existsSync(defaultConfigPath)) {
      require("fs").mkdirSync(configsDir, { recursive: true });
      require("fs").copyFileSync(defaultConfigPath, configPath);
    }
  }

  return configPath;
}

module.exports = { getBinaryPath, getConfigPath };
