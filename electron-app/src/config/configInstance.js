/**
 * @module config
 * @description Singleton configuration instance management for the Electron application.
 * Provides async wrappers for ConfigManager operations with lazy initialization.
 */

import { app } from "electron";
import { logger } from "../utils/logger.js";
import {
  getTemplatePath,
  getUserConfigPath,
  getVersionFilePath,
} from "../utils/paths.js";

// Store the singleton ConfigManager instance
let configManager = null;

/**
 * Gets or creates the singleton ConfigManager instance.
 * @returns {Promise<import("./configManager.js").ConfigManager>} The ConfigManager instance.
 * @example
 * const manager = await getConfigManager();
 * const config = await manager.read();
 */
async function getConfigManager() {
  // Lazy initialization: only create if not already exists
  if (!configManager) {
    // Dynamic import since configManager.js uses ES modules
    const { ConfigManager } = await import("./configManager.js");

    // Get paths for user config and template
    const userConfigPath = getUserConfigPath();
    const templatePath = getTemplatePath();
    const versionFilePath = getVersionFilePath();

    // Create new ConfigManager instance
    configManager = new ConfigManager(
      userConfigPath,
      templatePath,
      versionFilePath,
      app.getVersion(),
    );

    logger.config.info("ConfigManager initialized");
    logger.config.path("User config", userConfigPath);
    logger.config.path("User version config", versionFilePath);
    logger.config.path("Template path", templatePath);
  }

  // Return the singleton instance
  return configManager;
}

/**
 * Reads the current configuration from the user config file.
 * @returns {Promise<Object>} Parsed configuration object.
 * @throws {Error} Throws error if reading or parsing fails.
 * @example
 * const config = await readConfig();
 * console.log(config.database.host);
 */
async function readConfig() {
  // Get ConfigManager instance
  const manager = await getConfigManager();
  // Read and return parsed config
  return manager.read();
}

/**
 * Writes/updates the configuration with a new config object.
 * @param {Object} configObject - The configuration object to write.
 * @returns {Promise<boolean>} True if update was successful.
 * @throws {Error} Throws error if update fails.
 * @example
 * await writeConfig({ database: { host: "localhost", port: 5432 } });
 */
async function writeConfig(configObject) {
  // Get ConfigManager instance
  const manager = await getConfigManager();
  // Update config with new object
  return manager.update(configObject);
}

/**
 * Imports configuration from a file selected via dialog.
 * Creates a backup of current config before importing and validates the imported config.
 * @returns {Promise<boolean>} True if import was successful, false if dialog was canceled.
 * @throws {Error} Throws error if import fails or imported config is invalid.
 * @example
 * try {
 *   const success = await importConfig();
 *   if (success) {
 *     console.log("Config imported successfully");
 *   }
 * } catch (error) {
 *   console.error("Import failed:", error);
 * }
 */
async function importConfig() {
  // Dynamically import dialog from electron
  const { dialog } = await import("electron");

  try {
    // Show file open dialog for TOML files
    const result = await dialog.showOpenDialog({
      title: "Import Configuration",
      filters: [
        { name: "TOML Files", extensions: ["toml"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    // Check if user canceled or no file selected
    if (result.canceled || result.filePaths.length === 0) {
      return false;
    }

    // Get the selected file path
    const importPath = result.filePaths[0];
    // Get ConfigManager instance
    const manager = await getConfigManager();

    // Backup current config before importing
    manager.backup();

    // Read the imported config file
    const importedConfig = manager.read(importPath);

    // Update the current config with the imported config
    manager.update(importedConfig);

    // Validate the imported config
    const validation = manager.validate();
    // Throw error if validation fails
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

export { getConfigManager, importConfig, readConfig, writeConfig };
