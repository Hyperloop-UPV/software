import { beforeEach, expect, it, vi } from "vitest";
import { shell, dialog } from "electron";
import fs from "fs";
import { readConfig } from "../../config/configInstance.js";
import { openAppLocation, openProjectLink } from "../toolActions.js";

vi.mock("electron", () => ({
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
  dialog: { showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) },
}));
vi.mock("fs", () => ({ default: { existsSync: vi.fn(), mkdirSync: vi.fn() } }));
vi.mock("../../config/configInstance.js", () => ({ readConfig: vi.fn() }));
vi.mock("../../utils/paths.js", () => ({
  getBackendCachePath: () => "/system/cache/hyperloop-control-station",
  getBackendWorkingDir: () => "/work/backend/cmd",
  getUserConfigPath: () => "/user/configs/config.toml",
}));
vi.mock("../../utils/logger.js", () => ({
  logger: { electron: { error: vi.fn() } },
}));

beforeEach(() => {
  vi.clearAllMocks();
  fs.existsSync.mockReturnValue(true);
  shell.openPath.mockResolvedValue("");
  shell.openExternal.mockResolvedValue(undefined);
  readConfig.mockResolvedValue({});
});

it.each([
  ["cache", "/system/cache/hyperloop-control-station"],
  ["adj", "/system/cache/hyperloop-control-station/adj"],
  ["settings", "/user/configs"],
  ["config", "/user/configs/config.toml"],
])("opens %s in its OS default application", async (location, target) => {
  await openAppLocation(location);
  expect(shell.openPath).toHaveBeenCalledWith(target);
  expect(shell.openExternal).not.toHaveBeenCalled();
});

it.each([undefined, "", "."])(
  "uses Go's default logger path when logging_path is %s",
  async (loggingPath) => {
    readConfig.mockResolvedValue({ logging: { logging_path: loggingPath } });
    await openAppLocation("logger");
    expect(shell.openPath).toHaveBeenCalledWith("/work/backend/cmd/logger");
  },
);

it.each([
  ["../logs", "/work/backend/logs/logger"],
  ["/custom/data", "/custom/data/logger"],
])(
  "respects a configured logging path of %s",
  async (loggingPath, expected) => {
    readConfig.mockResolvedValue({ logging: { logging_path: loggingPath } });
    await openAppLocation("logger");
    expect(shell.openPath).toHaveBeenCalledWith(expected);
  },
);

it("creates the logger directory on first use instead of opening the wrong parent", async () => {
  fs.existsSync.mockReturnValueOnce(false).mockReturnValue(true);
  await openAppLocation("logger");
  expect(fs.mkdirSync).toHaveBeenCalledWith("/work/backend/cmd/logger", {
    recursive: true,
  });
  expect(shell.openPath).toHaveBeenCalledWith("/work/backend/cmd/logger");
});

it("opens the cache ADJ folder supported by the existing Go backend", async () => {
  await openAppLocation("adj");
  expect(shell.openPath).toHaveBeenCalledWith(
    "/system/cache/hyperloop-control-station/adj",
  );
  expect(readConfig).not.toHaveBeenCalled();
});

it("reports openPath error strings", async () => {
  shell.openPath.mockResolvedValue(
    "No application is associated with this file",
  );
  await openAppLocation("config");
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({
      detail: expect.stringContaining("No application is associated"),
    }),
  );
});

it("opens the ADJ repository and issue form without submitting an issue", async () => {
  await openProjectLink("adj");
  await openProjectLink("issue");
  expect(shell.openExternal.mock.calls).toEqual([
    ["https://github.com/Hyperloop-UPV/adj"],
    ["https://github.com/Hyperloop-UPV/software/issues/new/choose"],
  ]);
});
