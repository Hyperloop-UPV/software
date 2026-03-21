import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ELECTRON_APP_ROOT, mockArch, mockPlatform } from "./helpers.js";

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getAppPath: vi.fn().mockReturnValue("/mock/packaged/app"),
    getPath: vi.fn().mockReturnValue("/mock/userData"),
  },
}));

const { app } = await import("electron");
const { getBinaryPath } = await import("../paths.js");

beforeEach(() => {
  vi.clearAllMocks();
  app.isPackaged = false;
  mockPlatform("linux");
  mockArch("x64");
  process.resourcesPath = "/mock/resources";
});

describe("getBinaryPath", () => {
  it("dev win32/x64: appends .exe and maps to windows-amd64", () => {
    mockPlatform("win32");
    mockArch("x64");

    expect(getBinaryPath("backend")).toBe(
      path.join(ELECTRON_APP_ROOT, "binaries", "backend-windows-amd64.exe"),
    );
  });

  it("dev darwin/arm64: no .exe extension, maps to darwin-arm64", () => {
    mockPlatform("darwin");
    mockArch("arm64");

    expect(getBinaryPath("backend")).toBe(
      path.join(ELECTRON_APP_ROOT, "binaries", "backend-darwin-arm64"),
    );
  });

  it("dev linux/x64: no .exe extension, maps to linux-amd64", () => {
    expect(getBinaryPath("backend")).toBe(
      path.join(ELECTRON_APP_ROOT, "binaries", "backend-linux-amd64"),
    );
  });

  it("prod: uses process.resourcesPath instead of app root", () => {
    app.isPackaged = true;

    expect(getBinaryPath("backend")).toBe(
      path.join("/mock/resources", "binaries", "backend-linux-amd64"),
    );
  });

  it("unknown platform: falls back to raw platform name", () => {
    mockPlatform("freebsd");

    expect(getBinaryPath("backend")).toContain("backend-freebsd-");
  });

  it("unknown arch: falls back to raw arch name", () => {
    mockArch("mips");

    expect(getBinaryPath("backend")).toContain("-mips");
  });
});
