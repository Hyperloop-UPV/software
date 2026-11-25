import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  const app = new EventEmitter();
  app.whenReady = () => Promise.resolve();
  app.quit = vi.fn();
  return {
    app,
    BrowserWindow: { getAllWindows: vi.fn(() => []) },
    screen: {
      getPrimaryDisplay: () => ({ workAreaSize: { width: 1280, height: 800 } }),
    },
  };
});
vi.mock("../index.js", () => ({
  initializeApp: vi.fn().mockResolvedValue(undefined),
  handleSelectorFallback: vi.fn().mockResolvedValue(undefined),
  openMode: vi.fn().mockResolvedValue(undefined),
  showModeSelector: vi.fn().mockResolvedValue(undefined),
  setTransitionMode: vi.fn(),
  setupLifecycleHandlers: vi.fn(),
  setupUpdater: vi.fn(),
}));
vi.mock("../../processes/backend.js", () => ({
  stopBackend: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../processes/blcuProgramming.js", () => ({
  stopBlcuProgramming: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../utils/logger.js", () => ({
  logger: { electron: { info: vi.fn(), error: vi.fn() } },
}));
vi.mock("../../windows/mainWindow.js", () => ({
  getCurrentView: vi.fn(() => "testing-view"),
  getMainWindow: vi.fn(),
}));
vi.mock("../../windows/additionalViewWindow.js", () => ({
  createTestingWindow: vi.fn(),
  createCompetitionWindow: vi.fn(),
}));

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  const { app } = await import("electron");
  app.removeAllListeners();
  const { getCurrentView } = await import("../../windows/mainWindow.js");
  getCurrentView.mockReturnValue("testing-view");
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function start() {
  const electron = await import("electron");
  const modes = await import("../index.js");
  const backend = await import("../../processes/backend.js");
  await import("../../../main.js");
  await flush();
  return { ...electron, ...modes, ...backend };
}

describe("menu mode transitions", () => {
  it("opens a requested mode and closes previous windows after startup", async () => {
    const h = await start();
    const previous = {
      hide: vi.fn(),
      close: vi.fn(),
      removeAllListeners: vi.fn(),
      isDestroyed: () => false,
    };
    h.BrowserWindow.getAllWindows.mockReturnValue([previous]);
    let finish;
    h.openMode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    h.app.emit("switch-mode", "logging");
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.openMode).toHaveBeenCalledWith(1280, 800, "logging");
    expect(previous.hide).toHaveBeenCalledOnce();
    expect(previous.close).not.toHaveBeenCalled();
    finish();
    await flush();
    expect(previous.removeAllListeners).toHaveBeenCalledWith("close");
    expect(previous.close).toHaveBeenCalledOnce();
    expect(h.setTransitionMode).toHaveBeenLastCalledWith(false);
  });

  it("ignores repeated switch and return requests until the transition finishes", async () => {
    const h = await start();
    h.app.emit("return-to-selector");
    h.app.emit("switch-mode", "logging");
    h.app.emit("return-to-selector");
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.stopBackend).toHaveBeenCalledOnce();
    expect(h.showModeSelector).toHaveBeenCalledTimes(2);
    expect(h.openMode).not.toHaveBeenCalled();
  });

  it("ignores navigation while the startup selector is active", async () => {
    const modes = await import("../index.js");
    modes.showModeSelector.mockImplementationOnce(() => new Promise(() => {}));
    const h = await start();
    h.app.emit("return-to-selector");
    h.app.emit("switch-mode", "logging");
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.stopBackend).not.toHaveBeenCalled();
    expect(h.showModeSelector).toHaveBeenCalledOnce();
  });

  it("focuses the current mode instead of restarting its services", async () => {
    const h = await start();
    const { getMainWindow } = await import("../../windows/mainWindow.js");
    const window = { show: vi.fn(), focus: vi.fn() };
    getMainWindow.mockReturnValue(window);
    h.app.emit("switch-mode", "testing");
    await flush();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(h.stopBackend).not.toHaveBeenCalled();
    expect(h.openMode).not.toHaveBeenCalled();
  });

  it.each(["testing-view", "competition-view"])(
    "opens secondary Testing windows in %s without restarting services",
    async (view) => {
      const h = await start();
      const { getCurrentView, getMainWindow } =
        await import("../../windows/mainWindow.js");
      const { createTestingWindow } =
        await import("../../windows/additionalViewWindow.js");
      const mainWindow = {};
      getCurrentView.mockReturnValue(view);
      getMainWindow.mockReturnValue(mainWindow);
      h.app.emit("new-testing-window");
      h.app.emit("new-testing-window");
      expect(createTestingWindow).toHaveBeenCalledTimes(2);
      expect(createTestingWindow).toHaveBeenLastCalledWith(mainWindow);
      expect(h.stopBackend).not.toHaveBeenCalled();
      expect(h.openMode).not.toHaveBeenCalled();
    },
  );

  it("does not create extra windows during mode transitions or in Logging mode", async () => {
    const h = await start();
    const { getCurrentView } = await import("../../windows/mainWindow.js");
    const { createTestingWindow } =
      await import("../../windows/additionalViewWindow.js");
    getCurrentView.mockReturnValue("logging-view");
    h.app.emit("new-testing-window");
    expect(createTestingWindow).not.toHaveBeenCalled();
    getCurrentView.mockReturnValue("testing-view");
    h.app.emit("return-to-selector");
    h.app.emit("new-testing-window");
    expect(createTestingWindow).not.toHaveBeenCalled();
  });

  it("does not create extra windows before startup finishes", async () => {
    const modes = await import("../index.js");
    modes.showModeSelector.mockImplementationOnce(() => new Promise(() => {}));
    const h = await start();
    const { createTestingWindow } =
      await import("../../windows/additionalViewWindow.js");
    h.app.emit("new-testing-window");
    expect(createTestingWindow).not.toHaveBeenCalled();
  });

  it("opens additional Competition windows while preserving the Testing option", async () => {
    const h = await start();
    const { getCurrentView, getMainWindow } =
      await import("../../windows/mainWindow.js");
    const { createCompetitionWindow, createTestingWindow } =
      await import("../../windows/additionalViewWindow.js");
    getCurrentView.mockReturnValue("competition-view");
    const mainWindow = {};
    getMainWindow.mockReturnValue(mainWindow);
    h.app.emit("new-competition-window");
    h.app.emit("new-testing-window");
    expect(createCompetitionWindow).toHaveBeenCalledWith(mainWindow);
    expect(createTestingWindow).toHaveBeenCalledWith(mainWindow);
    expect(h.stopBackend).not.toHaveBeenCalled();
    expect(h.openMode).not.toHaveBeenCalled();
  });

  it("rejects new Competition windows outside Competition and during a transition", async () => {
    const h = await start();
    const { getCurrentView } = await import("../../windows/mainWindow.js");
    const { createCompetitionWindow } =
      await import("../../windows/additionalViewWindow.js");
    h.app.emit("new-competition-window");
    expect(createCompetitionWindow).not.toHaveBeenCalled();
    getCurrentView.mockReturnValue("competition-view");
    h.app.emit("return-to-selector");
    h.app.emit("new-competition-window");
    expect(createCompetitionWindow).not.toHaveBeenCalled();
  });
});
