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
const { getTemplatePath } = await import("../paths.js");

beforeEach(() => {
  vi.clearAllMocks();
  app.isPackaged = false;
  process.resourcesPath = "/mock/resources";
});

describe("getTemplatePath", () => {
  it("dev: returns dev-config.toml in backend/cmd/", () => {
    expect(getTemplatePath()).toBe(
      path.join(ELECTRON_APP_ROOT, "..", "backend", "cmd", "dev-config.toml"),
    );
  });

  it("prod: returns config.toml under process.resourcesPath", () => {
    app.isPackaged = true;

    expect(getTemplatePath()).toBe(
      path.join("/mock/resources", "config.toml"),
    );
  });
});
