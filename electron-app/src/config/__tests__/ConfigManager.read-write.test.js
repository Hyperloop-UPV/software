import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigManager } from "../configManager.js";

// Mock fs using Vitest's module mocking for CommonJS
vi.mock("fs");

import fs from "fs";

describe("ConfigManager - Read/Write Operations", () => {
  const templatePath = "/path/to/template.toml";
  const userConfigPath = "/path/to/user.toml";
  const mockTomlContent = `# User Config
name = "test"
enabled = true

[database]
host = "localhost"`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("read", () => {
    it("should read and parse TOML config", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockTomlContent);

      const manager = new ConfigManager(userConfigPath, templatePath);
      const config = manager.read();

      expect(config).toHaveProperty("name", "test");
      expect(config).toHaveProperty("enabled", true);
      expect(config.database).toHaveProperty("host", "localhost");
    });

    it("should throw error on invalid TOML", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue("invalid toml [[[");

      const manager = new ConfigManager(userConfigPath, templatePath);

      expect(() => manager.read()).toThrow("Failed to read config");
    });

    it("should throw error on file read failure", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const manager = new ConfigManager(userConfigPath, templatePath);

      expect(() => manager.read()).toThrow("Failed to read config");
    });
  });

  describe("readRaw", () => {
    it("should return raw TOML content", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockTomlContent);

      const manager = new ConfigManager(userConfigPath, templatePath);
      const raw = manager.readRaw();

      expect(raw).toBe(mockTomlContent);
      expect(raw).toContain("# User Config");
    });
  });

  describe("update", () => {
    it("should update config from object", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockTomlContent);
      fs.writeFileSync.mockImplementation(() => {});
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const manager = new ConfigManager(userConfigPath, templatePath);
      const result = manager.update({
        name: "updated",
        enabled: false,
      });

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("Config updated successfully");

      consoleSpy.mockRestore();
    });

    it("should throw error on update failure", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockTomlContent);
      fs.writeFileSync.mockImplementation(() => {
        throw new Error("Write failed");
      });

      const manager = new ConfigManager(userConfigPath, templatePath);

      expect(() => manager.update({ name: "test" })).toThrow(
        "Failed to update config"
      );
    });
  });

  describe("updateValue", () => {
    it("should update a single value", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockTomlContent);
      fs.writeFileSync.mockImplementation(() => {});
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const manager = new ConfigManager(userConfigPath, templatePath);
      const result = manager.updateValue("database", "host", "192.168.1.1");

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Updated database.host")
      );

      consoleSpy.mockRestore();
    });

    it("should throw error on value update failure", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error("Read failed");
      });

      const manager = new ConfigManager(userConfigPath, templatePath);

      expect(() => manager.updateValue("section", "key", "value")).toThrow(
        "Failed to update value"
      );
    });
  });
});
