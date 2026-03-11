import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigManager } from "../configManager.js";

// Mock fs module
vi.mock("fs");

describe("ConfigManager - Utility Methods", () => {
  const templatePath = "/path/to/template.toml";
  const userConfigPath = "/path/to/user.toml";
  const versionFilePath = "/path/to/version.toml";
  const appVersion = "1.0.0";
  const appVersionReturnValue = `version = "${appVersion}"`;
  const mockTomlContent = `# User Config
name = "test"
enabled = true

[database]
host = "localhost"`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resetToTemplate", () => {
    it("should reset config to template", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(appVersionReturnValue);
      fs.copyFileSync.mockImplementation(() => {});
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const manager = new ConfigManager(
        userConfigPath,
        templatePath,
        versionFilePath,
        appVersion,
      );

      const result = manager.resetToTemplate();

      expect(result).toBe(true);
      expect(fs.copyFileSync).toHaveBeenCalledWith(
        templatePath,
        userConfigPath,
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config reset to template"),
      );

      consoleSpy.mockRestore();
    });

    it("should throw error if template not found", () => {
      fs.existsSync.mockImplementation((path) => {
        if (path === templatePath) return false;
        return true;
      });
      fs.readFileSync.mockReturnValue(appVersionReturnValue);

      const manager = new ConfigManager(
        userConfigPath,
        templatePath,
        versionFilePath,
        appVersion,
      );

      expect(() => manager.resetToTemplate()).toThrow("Failed to reset config");
    });

    it("should throw error on copy failure", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(appVersionReturnValue);
      fs.copyFileSync.mockImplementation(() => {
        throw new Error("Copy failed");
      });

      const manager = new ConfigManager(
        userConfigPath,
        templatePath,
        versionFilePath,
        appVersion,
      );

      expect(() => manager.resetToTemplate()).toThrow("Failed to reset config");
    });
  });

  describe("backup", () => {
    it("should create backup with timestamp", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(appVersionReturnValue);
      fs.copyFileSync.mockImplementation(() => {});
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const manager = new ConfigManager(
        userConfigPath,
        templatePath,
        versionFilePath,
        appVersion,
      );
      const backupPath = manager.backup();

      expect(backupPath).toContain(".backup-");
      expect(fs.copyFileSync).toHaveBeenCalledWith(userConfigPath, backupPath);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config backed up to"),
      );

      consoleSpy.mockRestore();
    });

    it("should throw error on backup failure", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(appVersionReturnValue);
      fs.copyFileSync.mockImplementation(() => {
        throw new Error("Backup failed");
      });

      const manager = new ConfigManager(
        userConfigPath,
        templatePath,
        versionFilePath,
        appVersion,
      );

      expect(() => manager.backup()).toThrow("Failed to backup config");
    });

    it("should generate unique backup names", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(appVersionReturnValue);
      fs.copyFileSync.mockImplementation(() => {});

      const manager = new ConfigManager(
        userConfigPath,
        templatePath,
        versionFilePath,
        appVersion,
      );

      const backup1 = manager.backup();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const backup2 = manager.backup();

      expect(backup2).toBeDefined();
      expect(backup1).not.toBe(backup2);
    });
  });

  describe("validate", () => {
    it("should return valid for correct TOML", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValueOnce(appVersionReturnValue);
      fs.readFileSync.mockReturnValue(mockTomlContent);

      const manager = new ConfigManager(
        userConfigPath,
        templatePath,
        versionFilePath,
        appVersion,
      );

      const result = manager.validate();

      expect(result).toEqual({ valid: true });
    });

    it("should return error for invalid TOML", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValueOnce(appVersionReturnValue);
      fs.readFileSync.mockReturnValue("invalid [[[");

      const manager = new ConfigManager(
        userConfigPath,
        templatePath,
        versionFilePath,
        appVersion,
      );

      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle file read errors during validation", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValueOnce(appVersionReturnValue);
      fs.readFileSync.mockImplementation(() => {
        throw new Error("Read failed");
      });

      const manager = new ConfigManager(
        userConfigPath,
        templatePath,
        versionFilePath,
        appVersion,
      );

      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Read failed");
    });
  });
});
