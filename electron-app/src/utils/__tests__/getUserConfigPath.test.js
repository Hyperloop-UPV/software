import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ELECTRON_APP_ROOT } from "./helpers.js";

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getAppPath: vi.fn().mockReturnValue("/mock/packaged/app"),
    getPath: vi.fn().mockReturnValue("/mock/userData"),
  },
}));

const { app } = await import("electron");
const { getUserConfigPath } = await import("../paths.js");

beforeEach(() => {
  vi.clearAllMocks();
  app.isPackaged = false;
});

describe("getUserConfigPath", () => {
  it("dev: returns config.toml in electron-app root", () => {
    expect(getUserConfigPath()).toBe(
      path.join(ELECTRON_APP_ROOT, "config.toml"),
    );
  });

  it("prod: returns config.toml under userData/configs/", () => {
    app.isPackaged = true;
    app.getPath.mockReturnValue("/mock/userData");

    expect(getUserConfigPath()).toBe(
      path.join("/mock/userData", "configs", "config.toml"),
    );
    expect(app.getPath).toHaveBeenCalledWith("userData");
  });
});
