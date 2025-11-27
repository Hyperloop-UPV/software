import { getUserConfigPath, getTemplatePath } from "../utils/paths.js";

let configManager = null;

/**
 * Get or create the singleton ConfigManager instance
 */
async function getConfigManager() {
  if (!configManager) {
    // Dynamic import since configManager.js uses ES modules
    const { ConfigManager } = await import("./configManager.js");

    const userConfigPath = getUserConfigPath();
    const templatePath = getTemplatePath();

    configManager = new ConfigManager(userConfigPath, templatePath);
    console.log("ConfigManager initialized");
    console.log("  User config:", userConfigPath);
    console.log("  Template:", templatePath);
  }

  return configManager;
}

/**
 * Read config
 */
async function readConfig() {
  const manager = await getConfigManager();
  return manager.read();
}

/**
 * Write/update config
 */
async function writeConfig(configObject) {
  const manager = await getConfigManager();
  return manager.update(configObject);
}

/**
 * Import config from file dialog
 */
async function importConfig() {
  const { dialog } = await import("electron");
  const fs = await import("fs");

  try {
    const result = await dialog.showOpenDialog({
      title: "Import Configuration",
      filters: [
        { name: "TOML Files", extensions: ["toml"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return false;
    }

    const importPath = result.filePaths[0];
    const manager = await getConfigManager();

    // Backup current config before importing
    manager.backup();

    // Copy imported file to user config location
    fs.copyFileSync(importPath, manager.userConfigPath);

    // Validate the imported config
    const validation = manager.validate();
    if (!validation.valid) {
      throw new Error(`Invalid TOML file: ${validation.error}`);
    }

    console.log("Config imported successfully from:", importPath);
    return true;
  } catch (error) {
    console.error("Error importing config:", error);
    throw error;
  }
}

export { getConfigManager, readConfig, writeConfig, importConfig };
