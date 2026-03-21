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
const { getAppPath } = await import("../paths.js");

beforeEach(() => {
  vi.clearAllMocks();
  app.isPackaged = false;
});

describe("getAppPath", () => {
  it("dev: returns the electron-app root (2 levels up from src/utils)", () => {
    expect(path.normalize(getAppPath())).toBe(
      path.normalize(ELECTRON_APP_ROOT),
    );
  });

  it("prod: returns app.getAppPath()", () => {
    app.isPackaged = true;
    app.getAppPath.mockReturnValue("/prod/app");

    expect(getAppPath()).toBe("/prod/app");
  });
});
