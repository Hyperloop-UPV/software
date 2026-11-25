import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app, BrowserWindow, Menu } from "electron";
import fs from "fs";
import { createMenu, setWindowMenu } from "../menu.js";
import { getCurrentView, getMainWindow } from "../../windows/mainWindow.js";
import { showLogWindow } from "../../windows/logWindow.js";
import { checkForUpdates } from "../../app/updater.js";
import { showAboutWindow } from "../../windows/aboutWindow.js";
import { openAppLocation, openProjectLink } from "../toolActions.js";

vi.mock("electron", () => ({
  app: { emit: vi.fn(), quit: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn() },
  Menu: {
    buildFromTemplate: vi.fn((template) => {
      for (const item of template) {
        if (item.submenu) item.submenu.on = vi.fn();
      }
      return {
        items: template,
        getMenuItemById: (id) =>
          template
            .flatMap((item) => item.submenu ?? [])
            .find((item) => item.id === id),
      };
    }),
    setApplicationMenu: vi.fn(),
  },
}));
vi.mock("fs", () => ({ default: { existsSync: vi.fn() } }));
vi.mock("../../utils/paths.js", () => ({ getAppPath: () => "/app" }));
vi.mock("../../windows/mainWindow.js", () => ({
  getCurrentView: vi.fn(),
  getMainWindow: vi.fn(),
}));
vi.mock("../../windows/aboutWindow.js", () => ({ showAboutWindow: vi.fn() }));
vi.mock("../../windows/logWindow.js", () => ({ showLogWindow: vi.fn() }));
vi.mock("../../app/updater.js", () => ({ checkForUpdates: vi.fn() }));
vi.mock("../toolActions.js", () => ({
  openAppLocation: vi.fn(),
  openProjectLink: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  fs.existsSync.mockReturnValue(true);
  getCurrentView.mockReturnValue("logging-view");
});
afterEach(() => vi.unstubAllGlobals());

describe("Control Station menu", () => {
  it("provides the English menu bar and editing commands without Select All", () => {
    const menu = createMenu();
    expect(menu.items.map((item) => item.label)).toEqual([
      "Control Station",
      "Edit",
      "View",
      "Tools",
      "Window",
      "Help",
    ]);
    expect(
      menu.items
        .find((item) => item.label === "Edit")
        .submenu.filter((item) => item.role)
        .map((item) => item.role),
    ).toEqual(["undo", "redo", "cut", "copy", "paste"]);
    expect(
      menu.items
        .find((item) => item.label === "Help")
        .submenu.filter((item) => item.label)
        .map((item) => item.label),
    ).toEqual([
      "About Control Station",
      "Check for Updates...",
      "Report an Issue...",
    ]);
  });

  it("opens application locations from Tools and issue creation from Help", () => {
    const menu = createMenu();
    const window = {};
    const tools = menu.items.find((item) => item.label === "Tools").submenu;
    tools
      .find((item) => item.label === "Open ADJ Repository")
      .click(null, window);
    expect(openProjectLink).toHaveBeenCalledWith("adj", window);
    for (const [label, location] of [
      ["Open App Cache Folder", "cache"],
      ["Open Settings Folder", "settings"],
      ["Open Logger Folder", "logger"],
      ["Open config.toml", "config"],
      ["Open ADJ Folder", "adj"],
    ]) {
      tools.find((item) => item.label === label).click(null, window);
      expect(openAppLocation).toHaveBeenLastCalledWith(location, window);
    }
    menu.items
      .find((item) => item.label === "Help")
      .submenu.find((item) => item.label === "Report an Issue...")
      .click(null, window);
    expect(openProjectLink).toHaveBeenLastCalledWith("issue", window);
    expect(tools.some((item) => item.label === "Open Logger Settings")).toBe(
      false,
    );
  });

  it.each(["testing-view", "competition-view"])(
    "reopens backend logs in %s",
    (view) => {
      getCurrentView.mockReturnValue(view);
      const item = createMenu().getMenuItemById("show-backend-logs");
      expect(item.enabled).toBe(true);
      item.click();
      expect(showLogWindow).toHaveBeenCalledOnce();
    },
  );

  it.each(["logging-view", "adj-view", "flashing-view"])(
    "does not open backend logs in %s",
    (view) => {
      getCurrentView.mockReturnValue(view);
      const item = createMenu().getMenuItemById("show-backend-logs");
      expect(item.enabled).toBe(false);
      item.click();
      expect(showLogWindow).not.toHaveBeenCalled();
    },
  );

  it("refreshes log availability when Window opens after a mode change", () => {
    const menu = createMenu();
    getCurrentView.mockReturnValue("competition-view");
    const submenu = menu.items.find((item) => item.label === "Window").submenu;
    submenu.on.mock.calls[0][1]();
    expect(menu.getMenuItemById("show-backend-logs").enabled).toBe(true);
    expect(menu.getMenuItemById("new-testing-window").visible).toBe(true);
  });

  it.each(["testing-view", "competition-view"])(
    "offers an additional Testing window in %s",
    (view) => {
      getCurrentView.mockReturnValue(view);
      const item = createMenu().getMenuItemById("new-testing-window");
      expect(item.label).toBe("New Testing Window");
      expect(item.visible).toBe(true);
      expect(item.enabled).toBe(true);
      item.click();
      expect(app.emit).toHaveBeenCalledWith("new-testing-window");
    },
  );

  it.each(["logging-view", "adj-view", "flashing-view"])(
    "hides additional Testing windows in %s",
    (view) => {
      getCurrentView.mockReturnValue(view);
      const item = createMenu().getMenuItemById("new-testing-window");
      expect(item.visible).toBe(false);
      expect(item.enabled).toBe(false);
      item.click();
      expect(app.emit).not.toHaveBeenCalled();
    },
  );

  it("does not offer Testing windows when that view is not packaged", () => {
    getCurrentView.mockReturnValue("competition-view");
    fs.existsSync.mockReturnValue(false);
    const item = createMenu().getMenuItemById("new-testing-window");
    expect(item.visible).toBe(false);
    item.click();
    expect(app.emit).not.toHaveBeenCalled();
  });

  it("offers both Competition and Testing windows in Competition mode", () => {
    getCurrentView.mockReturnValue("competition-view");
    const menu = createMenu();
    const competition = menu.getMenuItemById("new-competition-window");
    expect(competition.visible).toBe(true);
    expect(competition.enabled).toBe(true);
    expect(competition.label).toBe("New Competition Window");
    expect(menu.getMenuItemById("new-testing-window").visible).toBe(true);
    competition.click();
    expect(app.emit).toHaveBeenCalledWith("new-competition-window");
  });

  it.each(["testing-view", "logging-view", "adj-view", "flashing-view"])(
    "hides new Competition windows in %s",
    (view) => {
      getCurrentView.mockReturnValue(view);
      const item = createMenu().getMenuItemById("new-competition-window");
      expect(item.visible).toBe(false);
      expect(item.enabled).toBe(false);
      item.click();
      expect(app.emit).not.toHaveBeenCalled();
    },
  );

  it("keeps Testing available if Competition is not packaged", () => {
    getCurrentView.mockReturnValue("competition-view");
    fs.existsSync.mockImplementation(
      (file) => file !== "/app/renderer/competition-view/index.html",
    );
    const menu = createMenu();
    const item = menu.getMenuItemById("new-competition-window");
    expect(item.visible).toBe(false);
    item.click();
    expect(app.emit).not.toHaveBeenCalled();
    expect(menu.getMenuItemById("new-testing-window").visible).toBe(true);
  });

  it("refreshes the new Competition option after changing mode", () => {
    getCurrentView.mockReturnValue("testing-view");
    const menu = createMenu();
    const refresh = menu.items.find((item) => item.label === "Window").submenu
      .on.mock.calls[0][1];
    getCurrentView.mockReturnValue("competition-view");
    refresh();
    expect(menu.getMenuItemById("new-competition-window").visible).toBe(true);
    getCurrentView.mockReturnValue("logging-view");
    refresh();
    expect(menu.getMenuItemById("new-competition-window").visible).toBe(false);
  });

  it("hides a stale new-window item after changing to a non-backend mode", () => {
    getCurrentView.mockReturnValue("testing-view");
    const menu = createMenu();
    getCurrentView.mockReturnValue("logging-view");
    menu.items
      .find((item) => item.label === "Window")
      .submenu.on.mock.calls[0][1]();
    const item = menu.getMenuItemById("new-testing-window");
    expect(item.visible).toBe(false);
    expect(item.enabled).toBe(false);
    item.click();
    expect(app.emit).not.toHaveBeenCalled();
  });

  it("restores and focuses the main window", () => {
    const window = {
      isDestroyed: () => false,
      isMinimized: () => true,
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    };
    getMainWindow.mockReturnValue(window);
    createMenu()
      .items.find((item) => item.label === "Window")
      .submenu[0].click();
    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
  });

  it("opens application information and update checks from any view", () => {
    getCurrentView.mockReturnValue("competition-view");
    const window = {};
    const items = createMenu().items.find(
      (item) => item.label === "Help",
    ).submenu;
    items[0].click(null, window);
    expect(showAboutWindow).toHaveBeenCalledWith(window);
    items[1].click(null, window);
    expect(checkForUpdates).toHaveBeenCalledWith(window);
  });

  it("orders reload, available views, return to selector and quit", () => {
    const menu = createMenu();
    expect(menu.items[0].label).toBe("Control Station");
    expect(
      menu.items[0].submenu
        .filter((item) => item.label)
        .map((item) => item.label),
    ).toEqual([
      "Reload",
      "Testing View",
      "Competition View",
      "Flashing View",
      "Logging View",
      "ADJ Viewer",
      "Return to Selector",
      "Quit",
    ]);
  });

  it("only offers views whose entry point is installed", () => {
    fs.existsSync.mockImplementation(
      (file) => file === "/app/renderer/logging-view/index.html",
    );
    const items = createMenu().items[0].submenu;
    expect(
      items
        .filter((item) => item.label?.endsWith("View"))
        .map((item) => item.label),
    ).toEqual(["Logging View"]);
    expect(items.some((item) => item.label === "ADJ Viewer")).toBe(false);
  });

  it("requests a mode change for each destination", () => {
    const items = createMenu().items[0].submenu;
    for (const [label, mode] of [
      ["Testing View", "testing"],
      ["Competition View", "competition"],
      ["Flashing View", "flashing"],
      ["Logging View", "logging"],
      ["ADJ Viewer", "adj"],
    ]) {
      items.find((item) => item.label === label).click();
      expect(app.emit).toHaveBeenLastCalledWith("switch-mode", mode);
    }
  });

  it("reloads the invoking window rather than whichever window is focused", () => {
    const window = { reload: vi.fn() };
    createMenu().items[0].submenu[0].click(null, window);
    expect(window.reload).toHaveBeenCalledOnce();
    expect(BrowserWindow.getFocusedWindow).not.toHaveBeenCalled();
  });

  it("preserves the selector menu without mode switching or nested selectors", () => {
    const menu = createMenu({ isSelector: true });
    expect(menu.items[0].label).toBe("File");
    expect(
      menu.items[0].submenu
        .filter((item) => item.label)
        .map((item) => item.label),
    ).toEqual(["Reload", "Return to Selector", "Exit"]);
    expect(
      menu.items[0].submenu.find((item) => item.label === "Return to Selector")
        .enabled,
    ).toBe(false);
  });

  it("assigns menus per window on Windows and Linux", () => {
    vi.stubGlobal("process", { ...process, platform: "linux" });
    const window = { setMenu: vi.fn() };
    setWindowMenu(window);
    expect(window.setMenu.mock.calls[0][0].items[0].label).toBe(
      "Control Station",
    );
    expect(Menu.setApplicationMenu).not.toHaveBeenCalled();
  });

  it("updates the macOS application menu when a window gains focus", () => {
    vi.stubGlobal("process", { ...process, platform: "darwin" });
    const window = { on: vi.fn(), isFocused: () => false };
    setWindowMenu(window, { isSelector: true });
    expect(window.on).toHaveBeenCalledWith("focus", expect.any(Function));
    window.on.mock.calls[0][1]();
    expect(Menu.setApplicationMenu.mock.calls[0][0].items[0].label).toBe(
      "File",
    );
  });
});
