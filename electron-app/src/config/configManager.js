import fs from "fs";
import path from "path";
import TOML from "@iarna/toml";

/**
 * Updates a single TOML value while preserving comments and formatting
 */
function updateTomlValue(tomlContent, section, key, newValue) {
  const lines = tomlContent.split(/\r?\n/);
  let currentSection = null;
  let updated = false;

  const result = lines.map((line) => {
    const trimmed = line.trim();

    // Track current section
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
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
    if (!inRightSection || updated) {
      return line;
    }

    // Parse the line: key = value # comment
    const match = line.match(
      /^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)(\s*=\s*)([^#]+?)((?:\s*#.*)?)$/
    );

    if (match && match[2] === key) {
      const [, indent, , equals, , comment] = match;

      // Format value based on type
      let formattedValue;
      if (typeof newValue === "string") {
        // Escape special characters
        const escaped = newValue.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        formattedValue = `"${escaped}"`;
      } else if (typeof newValue === "boolean") {
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
        formattedValue = newValue;
      }

      updated = true;
      return `${indent}${key}${equals}${formattedValue}${comment}`;
    }

    return line;
  });

  if (!updated) {
    console.warn(
      `Warning: Key "${key}" in section "${section || "root"}" not found`
    );
  }

  return result.join("\n");
}

/**
 * Updates TOML content from a complete config object
 */
function updateTomlFromObject(tomlContent, configObject, parentSection = null) {
  let result = tomlContent;

  for (const [key, value] of Object.entries(configObject)) {
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
 * Main ConfigManager class for Electron apps
 */
class ConfigManager {
  constructor(userConfigPath, templatePath) {
    this.userConfigPath = userConfigPath;
    this.templatePath = templatePath;

    // Ensure user config exists (copy from template on first run)
    this.ensureConfigExists();
  }

  /**
   * Ensure user config file exists
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
        fs.copyFileSync(this.templatePath, this.userConfigPath);
        console.log(`Created config from template: ${this.userConfigPath}`);
      } else {
        throw new Error(`Template not found: ${this.templatePath}`);
      }
    }
  }

  /**
   * Read and parse config (for displaying in GUI)
   */
  read() {
    try {
      const content = this.readRaw();
      return TOML.parse(content);
    } catch (error) {
      console.error("Error reading config:", error);
      throw new Error(`Failed to read config: ${error.message}`);
    }
  }

  /**
   * Read raw TOML content
   */
  readRaw() {
    return fs.readFileSync(this.userConfigPath, "utf-8");
  }

  /**
   * Update config from complete config object (preserves comments)
   */
  update(newConfigObject) {
    try {
      let content = this.readRaw();
      content = updateTomlFromObject(content, newConfigObject);
      fs.writeFileSync(this.userConfigPath, content, "utf-8");
      console.log("Config updated successfully");
      return true;
    } catch (error) {
      console.error("Error updating config:", error);
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Update a single value (preserves comments)
   */
  updateValue(section, key, value) {
    try {
      let content = fs.readFileSync(this.userConfigPath, "utf-8");
      content = updateTomlValue(content, section, key, value);
      fs.writeFileSync(this.userConfigPath, content, "utf-8");
      console.log(`Updated ${section}.${key} = ${value}`);
      return true;
    } catch (error) {
      console.error("Error updating value:", error);
      throw new Error(`Failed to update value: ${error.message}`);
    }
  }

  /**
   * Reset config to template (lose all customizations)
   */
  resetToTemplate() {
    try {
      if (!fs.existsSync(this.templatePath)) {
        throw new Error("Template file not found");
      }
      fs.copyFileSync(this.templatePath, this.userConfigPath);
      console.log("Config reset to template");
      return true;
    } catch (error) {
      console.error("Error resetting config:", error);
      throw new Error(`Failed to reset config: ${error.message}`);
    }
  }

  /**
   * Backup current config
   */
  backup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = `${this.userConfigPath}.backup-${timestamp}`;
      fs.copyFileSync(this.userConfigPath, backupPath);
      console.log(`Config backed up to: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error("Error backing up config:", error);
      throw new Error(`Failed to backup config: ${error.message}`);
    }
  }

  /**
   * Validate config structure
   */
  validate() {
    try {
      const content = fs.readFileSync(this.userConfigPath, "utf-8");
      TOML.parse(content); // Will throw if invalid
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }
}

export { ConfigManager, updateTomlValue, updateTomlFromObject };
