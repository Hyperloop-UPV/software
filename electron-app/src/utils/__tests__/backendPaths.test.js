import path from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { app } from "electron";
import {
  getBackendCachePath,
  getBackendWorkingDir,
  getAppPath,
} from "../paths.js";

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => "/user/data"),
  },
}));
beforeEach(() => {
  app.isPackaged = false;
});

it.each([
  [
    "linux",
    { HOME: "/users/me" },
    "/users/me/.cache/hyperloop-control-station",
  ],
  [
    "linux",
    { HOME: "/users/me", XDG_CACHE_HOME: "/custom/cache" },
    "/custom/cache/hyperloop-control-station",
  ],
  [
    "linux",
    { HOME: "/users/me", XDG_CACHE_HOME: "" },
    "/users/me/.cache/hyperloop-control-station",
  ],
  [
    "darwin",
    { HOME: "/Users/me", XDG_CACHE_HOME: "/ignored" },
    "/Users/me/Library/Caches/hyperloop-control-station",
  ],
  [
    "win32",
    { LocalAppData: "C:\\Users\\me\\AppData\\Local" },
    "C:\\Users\\me\\AppData\\Local\\hyperloop-control-station",
  ],
])("matches Go's cache location on %s with %j", (platform, env, expected) => {
  expect(getBackendCachePath({ platform, env })).toBe(expected);
});

it("rejects a relative XDG cache path like Go's os.UserCacheDir", () => {
  expect(() =>
    getBackendCachePath({
      platform: "linux",
      env: { XDG_CACHE_HOME: "cache" },
    }),
  ).toThrow("absolute XDG_CACHE_HOME");
});

it("reports a missing Go cache environment rather than guessing an Electron directory", () => {
  expect(() => getBackendCachePath({ platform: "linux", env: {} })).toThrow(
    "not configured",
  );
});

it("uses the same working directory for packaged and development backend paths", () => {
  expect(getBackendWorkingDir()).toBe(
    path.resolve(getAppPath(), "..", "backend", "cmd"),
  );
  app.isPackaged = true;
  expect(getBackendWorkingDir()).toBe("/user/data/configs");
});
