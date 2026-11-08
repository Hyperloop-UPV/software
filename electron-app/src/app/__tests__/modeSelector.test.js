import { beforeEach, describe, expect, it, vi } from "vitest";
import { openMode } from "../modeSelector.js";
import { startBackend } from "../../processes/backend.js";
import { startBlcuProgramming } from "../../processes/blcuProgramming.js";
import { createLogWindow, createWindow } from "../../windows/index.js";
import { loadView } from "../../windows/mainWindow.js";

vi.mock("electron", () => ({
  app: {},
  BrowserWindow: vi.fn(),
  ipcMain: {},
  screen: {},
}));
vi.mock("../../processes/backend.js", () => ({
  startBackend: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../processes/blcuProgramming.js", () => ({
  startBlcuProgramming: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../utils/logger.js", () => ({
  logger: { electron: { header: vi.fn(), error: vi.fn() } },
}));
vi.mock("../../utils/paths.js", () => ({ getAppPath: () => "/app" }));
vi.mock("../../menu/menu.js", () => ({ setWindowMenu: vi.fn() }));
vi.mock("../../windows/index.js", () => ({
  createWindow: vi.fn(),
  createLogWindow: vi.fn(),
}));
vi.mock("../../windows/mainWindow.js", () => ({ loadView: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  createWindow.mockReturnValue({
    maximize: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
  });
  createLogWindow.mockReturnValue({ show: vi.fn() });
});

describe("mode service startup", () => {
  it.each(["testing", "competition"])(
    "waits for the backend before loading %s",
    async (mode) => {
      let ready;
      startBackend.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            ready = resolve;
          }),
      );
      const opening = openMode(1280, 800, mode);
      expect(startBackend).toHaveBeenCalledOnce();
      expect(loadView).not.toHaveBeenCalled();
      ready();
      await opening;
      expect(loadView).toHaveBeenCalledWith(`${mode}-view`);
      expect(startBlcuProgramming).not.toHaveBeenCalled();
    },
  );

  it.each(["logging", "adj"])(
    "opens %s without starting services",
    async (mode) => {
      await openMode(1280, 800, mode);
      expect(loadView).toHaveBeenCalledWith(`${mode}-view`);
      expect(startBackend).not.toHaveBeenCalled();
      expect(startBlcuProgramming).not.toHaveBeenCalled();
      expect(createLogWindow).not.toHaveBeenCalled();
    },
  );

  it("starts the programming service before opening Flashing View", async () => {
    vi.useFakeTimers();
    try {
      const opening = openMode(1280, 800, "flashing");
      await vi.advanceTimersByTimeAsync(4999);
      expect(startBlcuProgramming).toHaveBeenCalledOnce();
      expect(loadView).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await opening;
      expect(loadView).toHaveBeenCalledWith("flashing-view");
      expect(startBackend).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
