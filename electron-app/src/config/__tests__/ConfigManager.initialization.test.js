import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigManager } from "../configManager.js";

// Mock fs module
vi.mock("fs");

describe("ConfigManager - Initialization", () => {
  const templatePath = "/path/to/template.toml";
  const userConfigPath = "/path/to/user.toml";
  const versionFilePath = "/path/to/version.toml";
  const appVersion = "1.0.0";
  const appVersionReturnValue = `version = "${appVersion}"`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create config manager instance", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(appVersionReturnValue);

    const manager = new ConfigManager(
      userConfigPath,
      templatePath,
      versionFilePath,
      appVersion,
    );

    expect(manager.userConfigPath).toBe(userConfigPath);
    expect(manager.templatePath).toBe(templatePath);
  });

  it("should create directory if it does not exist", () => {
    fs.existsSync.mockImplementation((path) => {
      if (path === "/path/to") return false;
      return true;
    });
    fs.mkdirSync.mockImplementation(() => {});
    fs.readFileSync.mockReturnValue(appVersionReturnValue);

    new ConfigManager(userConfigPath, templatePath, versionFilePath, appVersion);

    expect(fs.mkdirSync).toHaveBeenCalledWith("/path/to", {
      recursive: true,
    });
  });

  it("should copy template if user config does not exist", () => {
    fs.existsSync.mockImplementation((path) => {
      if (path === userConfigPath) return false;
      return true;
    });
    fs.copyFileSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    new ConfigManager(userConfigPath, templatePath, versionFilePath, appVersion);

    expect(fs.copyFileSync).toHaveBeenCalledWith(templatePath, userConfigPath);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Created config from template"),
    );

    consoleSpy.mockRestore();
  });

  it("should throw error if template does not exist", () => {
    fs.existsSync.mockReturnValue(false);

    expect(() => {
      new ConfigManager(userConfigPath, templatePath, versionFilePath, appVersion);
    }).toThrow("Template not found");
  });
});
