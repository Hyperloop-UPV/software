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
const { getVersionFilePath } = await import("../paths.js");

beforeEach(() => {
  vi.clearAllMocks();
  app.isPackaged = false;
});

describe("getVersionFilePath", () => {
  it("dev: returns version.toml in electron-app root", () => {
    expect(getVersionFilePath()).toBe(
      path.join(ELECTRON_APP_ROOT, "version.toml"),
    );
  });

  it("prod: returns version.toml directly under userData/", () => {
    app.isPackaged = true;
    app.getPath.mockReturnValue("/mock/userData");

    expect(getVersionFilePath()).toBe(
      path.join("/mock/userData", "version.toml"),
    );
    expect(app.getPath).toHaveBeenCalledWith("userData");
  });
});
