/**
 * @module config
 * @description Configuration management for TOML files with comment preservation.
 * Handles reading, writing, and updating configuration files while maintaining formatting and comments.
 */

import fs from "fs";
import path from "path";
import TOML from "@iarna/toml";
import { logger } from "../utils/logger.js";

/**
 * Updates a single TOML value while preserving comments and formatting.
 * @param {string} tomlContent - The TOML file content as a string.
 * @param {string | null} section - The section name (e.g., "database") or null for root level.
 * @param {string} key - The key to update.
 * @param {any} newValue - The new value to set.
 * @returns {string} Updated TOML content with the new value.
 * @example
 * const content = '[database]\nhost = "localhost" # comment';
 * const updated = updateTomlValue(content, "database", "host", "192.168.1.1");
 */
function updateTomlValue(tomlContent, section, key, newValue) {
  const lineEnding = tomlContent.includes("\r\n") ? "\r\n" : "\n";
  // Split content into lines for processing
  const lines = tomlContent.split(/\r?\n/);
  // Track current section while iterating
  let currentSection = null;
  // Flag to track if update was successful
  let updated = false;
  // Track if we're inside a multiline string
  let inMultilineString = false;

  // Process each line
  const result = lines.map((line) => {
    // Get trimmed version for parsing
    const trimmed = line.trim();

    // Track multiline string boundaries (""" or ''')
    const tripleDoubleQuotes = (line.match(/"""/g) || []).length;
    const tripleSingleQuotes = (line.match(/'''/g) || []).length;
    if (tripleDoubleQuotes % 2 !== 0 || tripleSingleQuotes % 2 !== 0) {
      inMultilineString = !inMultilineString;
      return line;
    }
    if (inMultilineString) return line;

    // Track current section
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      // Update current section when we encounter a section header
      currentSection = sectionMatch[1];
      return line;
    }

    // Skip empty lines and pure comments
    if (!trimmed || trimmed.startsWith("#")) {
      return line;
    }

    // Check if we're in the right section (or no section needed)
    const inRightSection = section
      ? currentSection === section
      : currentSection === null;
    // Skip if not in right section or already updated
    if (!inRightSection || updated) {
      return line;
    }

    // Parse the line: key = value # comment
    const match = line.match(
      /^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)(\s*=\s*)([^#]+?)((?:\s*#.*)?)$/
    );

    // Check if this line matches the key we're looking for
    if (match && match[2] === key) {
      // Extract components: indent, key, equals, value, comment
      const [, indent, , equals, , comment] = match;

      // Format value based on type
      let formattedValue;
      if (typeof newValue === "string") {
        // Escape special characters for strings
        const escaped = newValue.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        formattedValue = `"${escaped}"`;
      } else if (typeof newValue === "boolean") {
        // Booleans as-is
        formattedValue = newValue.toString();
      } else if (Array.isArray(newValue)) {
        // Simple array formatting
        const items = newValue.map((v) =>
          typeof v === "string" ? `"${v}"` : v
        );
        formattedValue = `[${items.join(", ")}]`;
      } else if (newValue === null || newValue === undefined) {
        // Skip null/undefined values
        return line;
      } else {
        // Numbers and other types as-is
        formattedValue = newValue;
      }

      // Mark as updated and return new line
      updated = true;
      return `${indent}${key}${equals}${formattedValue}${comment}`;
    }

    return line;
  });

  // Warn if key was not found
  if (!updated) {
    console.warn(
      `Warning: Key "${key}" in section "${section || "root"}" not found`
    );
  }

  // Join lines back into string
  return result.join(lineEnding);
}

/**
 * Updates TOML content from a complete config object.
 * @param {string} tomlContent - The TOML file content as a string.
 * @param {Object} configObject - The configuration object to apply.
 * @param {string | null} [parentSection=null] - The parent section name for nested updates.
 * @returns {string} Updated TOML content.
 * @example
 * const content = '[database]\nhost = "localhost"';
 * const config = { database: { host: "192.168.1.1", port: 5432 } };
 * const updated = updateTomlFromObject(content, config);
 */
function updateTomlFromObject(tomlContent, configObject, parentSection = null) {
  // Start with original content
  let result = tomlContent;

  // Iterate through all keys in config object
  for (const [key, value] of Object.entries(configObject)) {
    // Check if value is a nested object (section)
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      // It's a section with nested values
      if (!parentSection) {
        // First level: treat as section
        result = updateTomlFromObject(result, value, key);
      } else {
        // Nested sections (e.g., [database.connection])
        const nestedSection = `${parentSection}.${key}`;
        result = updateTomlFromObject(result, value, nestedSection);
      }
    } else {
      // It's a primitive value - update it
      result = updateTomlValue(result, parentSection, key, value);
    }
  }

  return result;
}

/**
 * Main ConfigManager class for Electron apps.
 * @class
 */
class ConfigManager {
  /**
   * Creates a new ConfigManager instance.
   * @param {string} userConfigPath - Path to the user configuration file.
   * @param {string} templatePath - Path to the template configuration file.
   * @example
   * const manager = new ConfigManager("/path/to/config.toml", "/path/to/template.toml");
   */
  constructor(userConfigPath, templatePath) {
    // Store paths
    this.userConfigPath = userConfigPath;
    this.templatePath = templatePath;

    // Ensure user config exists (copy from template on first run)
    this.ensureConfigExists();
  }

  /**
   * Ensures user config file exists, creating it from template if needed.
   * @returns {void}
   * @example
   * manager.ensureConfigExists();
   */
  ensureConfigExists() {
    // Create directory if it doesn't exist
    const dir = path.dirname(this.userConfigPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Copy template if user config doesn't exist
    if (!fs.existsSync(this.userConfigPath)) {
      if (fs.existsSync(this.templatePath)) {
        // Copy template to user config location
        fs.copyFileSync(this.templatePath, this.userConfigPath);
        logger.config.info(
          `Created config from template: ${this.userConfigPath}`
        );
      } else {
        // Throw error if template is missing
        throw new Error(`Template not found: ${this.templatePath}`);
      }
    }
  }

  /**
   * Reads and parses config file.
   * @param {string} [configPath] - Optional path to config file, defaults to user config path.
   * @returns {Object} Parsed configuration object.
   * @throws {Error} Throws error if reading or parsing fails.
   * @example
   * const config = manager.read();
   * const customConfig = manager.read("/path/to/custom.toml");
   */
  read(configPath) {
    try {
      // Read raw content and parse as TOML
      const content = this.readRaw(configPath);
      return TOML.parse(content);
    } catch (error) {
      logger.config.error("Error reading config:", error);
      throw new Error(`Failed to read config: ${error.message}`);
    }
  }

  /**
   * Reads raw TOML content from file.
   * @param {string} [configPath] - Optional path to config file, defaults to user config path.
   * @returns {string} Raw TOML content as string.
   * @example
   * const rawContent = manager.readRaw();
   */
  readRaw(configPath = this.userConfigPath) {
    // Read file as UTF-8 string
    return fs.readFileSync(configPath, "utf-8");
  }

  /**
   * Updates config from complete config object while preserving comments.
   * @param {Object} newConfigObject - The new configuration object to apply.
   * @returns {boolean} True if update was successful.
   * @throws {Error} Throws error if update fails.
   * @example
   * manager.update({ database: { host: "localhost", port: 5432 } });
   */
  update(newConfigObject) {
    try {
      // Read current content
      let content = this.readRaw();
      // Update content with new config object
      content = updateTomlFromObject(content, newConfigObject);
      // Write updated content back to file
      fs.writeFileSync(this.userConfigPath, content, "utf-8");
      logger.config.info("Config updated successfully");
      return true;
    } catch (error) {
      logger.config.error("Error updating config:", error);
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Updates a single value while preserving comments.
   * @param {string | null} section - The section name or null for root level.
   * @param {string} key - The key to update.
   * @param {any} value - The new value.
   * @returns {boolean} True if update was successful.
   * @throws {Error} Throws error if update fails.
   * @example
   * manager.updateValue("database", "host", "localhost");
   * manager.updateValue(null, "appName", "MyApp");
   */
  updateValue(section, key, value) {
    try {
      // Read current content
      let content = fs.readFileSync(this.userConfigPath, "utf-8");
      // Update single value
      content = updateTomlValue(content, section, key, value);
      // Write updated content back to file
      fs.writeFileSync(this.userConfigPath, content, "utf-8");
      logger.config.info(`Updated ${section}.${key} = ${value}`);
      return true;
    } catch (error) {
      logger.config.error("Error updating value:", error);
      throw new Error(`Failed to update value: ${error.message}`);
    }
  }

  /**
   * Resets config to template, losing all customizations.
   * @returns {boolean} True if reset was successful.
   * @throws {Error} Throws error if reset fails.
   * @example
   * manager.resetToTemplate();
   */
  resetToTemplate() {
    try {
      // Check if template exists
      if (!fs.existsSync(this.templatePath)) {
        throw new Error("Template file not found");
      }
      // Copy template over user config
      fs.copyFileSync(this.templatePath, this.userConfigPath);
      logger.config.info("Config reset to template");
      return true;
    } catch (error) {
      logger.config.error("Error resetting config:", error);
      throw new Error(`Failed to reset config: ${error.message}`);
    }
  }

  /**
   * Creates a backup of the current config file.
   * @returns {string} Path to the backup file.
   * @throws {Error} Throws error if backup fails.
   * @example
   * const backupPath = manager.backup();
   * console.log(`Backup created at: ${backupPath}`);
   */
  backup() {
    try {
      // Generate timestamp for backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = `${this.userConfigPath}.backup-${timestamp}`;
      // Copy current config to backup location
      fs.copyFileSync(this.userConfigPath, backupPath);
      logger.config.info(`Config backed up to: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.config.error("Error backing up config:", error);
      throw new Error(`Failed to backup config: ${error.message}`);
    }
  }

  /**
   * Validates the config file structure.
   * @returns {{valid: boolean, error?: string}} Validation result object.
   * @example
   * const result = manager.validate();
   * if (!result.valid) {
   *   console.error(`Config invalid: ${result.error}`);
   * }
   */
  validate() {
    try {
      // Read and attempt to parse config
      const content = fs.readFileSync(this.userConfigPath, "utf-8");
      TOML.parse(content); // Will throw if invalid
      // Return success if parsing succeeds
      return { valid: true };
    } catch (error) {
      // Return validation failure with error message
      return {
        valid: false,
        error: error.message,
      };
    }
  }
}

export { ConfigManager, updateTomlValue, updateTomlFromObject };
