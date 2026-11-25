import { beforeEach, expect, it, vi } from "vitest";
import { app, dialog } from "electron";
import pkg from "electron-updater";

vi.mock("electron", () => ({
  app: { isPackaged: true, getVersion: () => "1.2.3" },
  dialog: { showMessageBox: vi.fn().mockResolvedValue({ response: 1 }) },
}));
vi.mock("electron-updater", () => ({
  default: {
    autoUpdater: {
      on: vi.fn(),
      checkForUpdates: vi.fn(),
      quitAndInstall: vi.fn(),
    },
  },
}));
vi.mock("../../utils/logger.js", () => ({
  logger: {
    electron: {
      info: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  app.isPackaged = true;
  pkg.autoUpdater.checkForUpdates.mockReset();
});

it("reports that the installed version is up to date", async () => {
  pkg.autoUpdater.checkForUpdates.mockResolvedValue({
    isUpdateAvailable: false,
  });
  const { checkForUpdates } = await import("../updater.js");
  await checkForUpdates();
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({
      message: "Control Station is up to date.",
      detail: "Current version: 1.2.3",
    }),
  );
});

it("reports an available download without restarting automatically", async () => {
  pkg.autoUpdater.checkForUpdates.mockResolvedValue({
    isUpdateAvailable: true,
    updateInfo: { version: "2.0.0" },
  });
  const { checkForUpdates } = await import("../updater.js");
  await checkForUpdates();
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Version 2.0.0 is available." }),
  );
  expect(pkg.autoUpdater.quitAndInstall).not.toHaveBeenCalled();
});

it("shows a failed check instead of silently logging it", async () => {
  pkg.autoUpdater.checkForUpdates.mockRejectedValue(new Error("Offline"));
  const { checkForUpdates } = await import("../updater.js");
  await checkForUpdates();
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({ type: "error", detail: "Offline" }),
  );
});

it("does not query release servers in a development build", async () => {
  app.isPackaged = false;
  const { checkForUpdates, setupUpdater } = await import("../updater.js");
  setupUpdater();
  await checkForUpdates();
  expect(pkg.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({
      message: "Updates are available in installed builds of Control Station.",
    }),
  );
});

it("coalesces repeated manual checks and registers updater handlers once", async () => {
  let finish;
  pkg.autoUpdater.checkForUpdates.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { checkForUpdates } = await import("../updater.js");
  const first = checkForUpdates();
  const second = checkForUpdates();
  expect(pkg.autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  finish({ isUpdateAvailable: false });
  await Promise.all([first, second]);
  expect(dialog.showMessageBox).toHaveBeenCalledOnce();
  expect(
    pkg.autoUpdater.on.mock.calls.filter(
      ([event]) => event === "update-downloaded",
    ),
  ).toHaveLength(1);
});
