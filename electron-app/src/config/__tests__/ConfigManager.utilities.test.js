import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import { ConfigManager } from "../configManager.js";

// Mock fs module
vi.mock("fs");

describe("ConfigManager - Utility Methods", () => {
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

  describe("resetToTemplate", () => {
    it("should reset config to template", () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const manager = new ConfigManager(userConfigPath, templatePath);
      const result = manager.resetToTemplate();

      expect(result).toBe(true);
      expect(fs.copyFileSync).toHaveBeenCalledWith(
        templatePath,
        userConfigPath
      );
      expect(consoleSpy).toHaveBeenCalledWith("Config reset to template");

      consoleSpy.mockRestore();
    });

    it("should throw error if template not found", () => {
      fs.existsSync.mockImplementation((path) => {
        if (path === templatePath) return false;
        return true;
      });

      const manager = new ConfigManager(userConfigPath, templatePath);

      expect(() => manager.resetToTemplate()).toThrow("Failed to reset config");
    });

    it("should throw error on copy failure", () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {
        throw new Error("Copy failed");
      });

      const manager = new ConfigManager(userConfigPath, templatePath);

      expect(() => manager.resetToTemplate()).toThrow("Failed to reset config");
    });
  });

  describe("backup", () => {
    it("should create backup with timestamp", () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const manager = new ConfigManager(userConfigPath, templatePath);
      const backupPath = manager.backup();

      expect(backupPath).toContain(".backup-");
      expect(fs.copyFileSync).toHaveBeenCalledWith(userConfigPath, backupPath);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config backed up to")
      );

      consoleSpy.mockRestore();
    });

    it("should throw error on backup failure", () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {
        throw new Error("Backup failed");
      });

      const manager = new ConfigManager(userConfigPath, templatePath);

      expect(() => manager.backup()).toThrow("Failed to backup config");
    });

    it("should generate unique backup names", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});

      const manager = new ConfigManager(userConfigPath, templatePath);
      const backup1 = manager.backup();

      await new Promise((resolve) => setTimeout(resolve, 1));

      const backup2 = manager.backup();

      expect(backup2).toBeDefined();
      expect(backup1).not.toBe(backup2);
    });
  });

  describe("validate", () => {
    it("should return valid for correct TOML", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockTomlContent);

      const manager = new ConfigManager(userConfigPath, templatePath);
      const result = manager.validate();

      expect(result).toEqual({ valid: true });
    });

    it("should return error for invalid TOML", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue("invalid [[[");

      const manager = new ConfigManager(userConfigPath, templatePath);
      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle file read errors during validation", () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error("Read failed");
      });

      const manager = new ConfigManager(userConfigPath, templatePath);
      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Read failed");
    });
  });
});
