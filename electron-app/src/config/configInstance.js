import { getUserConfigPath, getTemplatePath } from "../utils/paths.js";
import { logger } from "../utils/logger.js";

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
    logger.config.info("ConfigManager initialized");
    logger.config.info("User config:", userConfigPath);
    logger.config.info("Template:", templatePath);
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

    // Read the imported config
    const importedConfig = manager.read(importPath);

    // Update the current config with the imported config
    manager.update(importedConfig);

    // Validate the imported config
    const validation = manager.validate();
    if (!validation.valid) {
      throw new Error(`Invalid TOML file: ${validation.error}`);
    }

    logger.config.info("Config imported successfully from:", importPath);
    return true;
  } catch (error) {
    logger.config.error("Error importing config:", error);
    throw error;
  }
}

export { getConfigManager, readConfig, writeConfig, importConfig };
