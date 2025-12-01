import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import { ConfigManager } from "../configManager.js";

// Mock fs module
vi.mock("fs");

describe("ConfigManager - Initialization", () => {
  const templatePath = "/path/to/template.toml";
  const userConfigPath = "/path/to/user.toml";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create config manager instance", () => {
    fs.existsSync.mockReturnValue(true);

    const manager = new ConfigManager(userConfigPath, templatePath);

    expect(manager.userConfigPath).toBe(userConfigPath);
    expect(manager.templatePath).toBe(templatePath);
  });

  it("should create directory if it does not exist", () => {
    fs.existsSync.mockImplementation((path) => {
      if (path === "/path/to") return false;
      return true;
    });
    fs.mkdirSync.mockImplementation(() => {});

    new ConfigManager(userConfigPath, templatePath);

    expect(fs.mkdirSync).toHaveBeenCalledWith("/path/to", {
      recursive: true,
    });
  });

  it("should copy template if user config does not exist", () => {
    fs.existsSync.mockImplementation((path) => {
      if (path === userConfigPath) return false;
      if (path === templatePath) return true;
      return true;
    });
    fs.copyFileSync.mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    new ConfigManager(userConfigPath, templatePath);

    expect(fs.copyFileSync).toHaveBeenCalledWith(templatePath, userConfigPath);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Created config from template")
    );

    consoleSpy.mockRestore();
  });

  it("should throw error if template does not exist", () => {
    fs.existsSync.mockReturnValue(false);

    expect(() => {
      new ConfigManager(userConfigPath, templatePath);
    }).toThrow("Template not found");
  });
});
