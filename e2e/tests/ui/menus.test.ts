import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/electron";

for (const view of ["Testing View", "Competition View"]) {
  test(`Window reopens backend logs with history in ${view}`, async ({
    app,
  }) => {
    test.setTimeout(60_000);
    if (view === "Competition View") {
      const available = await app.evaluate(({ Menu }) =>
        Menu.getApplicationMenu()!.items[0].submenu!.items.some(
          (item) => item.label === "Competition View",
        ),
      );
      test.skip(!available, "Competition View is not installed");
      await app.evaluate(({ BrowserWindow, Menu }) => {
        const item = Menu.getApplicationMenu()!.items[0].submenu!.items.find(
          (item) => item.label === "Competition View",
        )!;
        item.click(item, BrowserWindow.getAllWindows()[0], {} as never);
      });
      await expect
        .poll(
          () =>
            app
              .windows()
              .some((window) =>
                window.url().includes("/competition-view/index.html"),
              ),
          { timeout: 15_000 },
        )
        .toBe(true);
      await expect
        .poll(() =>
          app
            .windows()
            .some((window) =>
              window.url().includes("/testing-view/index.html"),
            ),
        )
        .toBe(false);
    }

    const logs = app
      .windows()
      .find((window) => window.url().includes("/log-viewer/index.html"))!;
    await expect(logs.locator("#log-container")).not.toBeEmpty();
    const firstLine = await logs
      .locator("#log-container > div")
      .first()
      .innerText();
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((window) =>
          window.webContents.getURL().includes("/log-viewer/index.html"),
        )!
        .close();
    });
    const opened = app.waitForEvent("window");
    await app.evaluate(({ BrowserWindow, Menu }) => {
      const menu = Menu.getApplicationMenu()!;
      menu.items
        .find((item) => item.label === "Window")!
        .submenu!.emit("menu-will-show");
      const item = menu.getMenuItemById("show-backend-logs")!;
      if (!item.enabled) throw new Error("Backend logs should be available");
      item.click(item, BrowserWindow.getAllWindows()[0], {} as never);
    });
    const reopened = await opened;
    await expect(reopened).toHaveTitle("Backend Logs");
    await expect(reopened.locator("#log-container")).toContainText(firstLine);
    expect(
      await app.evaluate(
        ({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().filter((window) =>
            window.webContents.getURL().includes("/log-viewer/index.html"),
          ).length,
      ),
    ).toBe(1);
  });
}

test("English menus and About are available in Testing View", async ({
  app,
}) => {
  const menus = await app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu()!;
    return {
      labels: menu.items.map((item) => item.label),
      edit: menu.items
        .find((item) => item.label === "Edit")!
        .submenu!.items.map((item) => item.role)
        .filter(Boolean),
      help: menu.items
        .find((item) => item.label === "Help")!
        .submenu!.items.filter((item) => item.type !== "separator")
        .map((item) => item.label),
    };
  });
  expect(menus.labels).toEqual([
    "Control Station",
    "Edit",
    "View",
    "Tools",
    "Window",
    "Help",
  ]);
  expect(menus.edit).toEqual(["undo", "redo", "cut", "copy", "paste"]);
  expect(menus.help).toEqual([
    "About Control Station",
    "Check for Updates...",
    "Report an Issue...",
  ]);
  const opened = app.waitForEvent("window");
  await app.evaluate(({ BrowserWindow, Menu }) => {
    const item = Menu.getApplicationMenu()!.items.find(
      (item) => item.label === "Help",
    )!.submenu!.items[0];
    const main = BrowserWindow.getAllWindows().find((window) =>
      window.webContents.getURL().includes("/testing-view/"),
    )!;
    item.click(item, main, {} as never);
  });
  const about = await opened;
  await expect(about).toHaveTitle("About Control Station");
  await expect(about.locator("#app-version")).toContainText("Version");
});

async function openAdjFromRenderer(page: Page) {
  await page.evaluate(() => {
    const { electronAPI } = window as unknown as {
      electronAPI: { switchView: (view: string) => Promise<string> };
    };
    void electronAPI.switchView("adj-view");
  });
  await expect(page).toHaveURL(/\/adj-view\/index\.html$/);
}

test("Tools opens app locations and project pages through the OS", async ({
  app,
}) => {
  const opened = await app.evaluate(async ({ BrowserWindow, Menu, shell }) => {
    const paths: string[] = [];
    const urls: string[] = [];
    const originalOpenPath = shell.openPath;
    const originalOpenExternal = shell.openExternal;
    shell.openPath = async (target) => {
      paths.push(target);
      return "";
    };
    shell.openExternal = async (url) => {
      urls.push(url);
    };
    try {
      const menu = Menu.getApplicationMenu()!;
      const tools = menu.items.find((item) => item.label === "Tools")!.submenu!;
      const window = BrowserWindow.getAllWindows()[0];
      for (const label of [
        "Open ADJ Repository",
        "Open App Cache Folder",
        "Open Settings Folder",
        "Open Logger Folder",
        "Open config.toml",
        "Open ADJ Folder",
      ]) {
        const item = tools.items.find((item) => item.label === label)!;
        await item.click(item, window, {} as never);
      }
      const issue = menu.items
        .find((item) => item.label === "Help")!
        .submenu!.items.find((item) => item.label === "Report an Issue...")!;
      await issue.click(issue, window, {} as never);
      await new Promise<void>((resolve) => setImmediate(resolve));
      return {
        paths,
        urls,
        tools: tools.items
          .filter((item) => item.type !== "separator")
          .map((item) => item.label),
      };
    } finally {
      shell.openPath = originalOpenPath;
      shell.openExternal = originalOpenExternal;
    }
  });
  expect(opened.paths).toHaveLength(5);
  expect(opened.paths.some((target) => target.endsWith("config.toml"))).toBe(
    true,
  );
  expect(opened.paths.some((target) => target.endsWith("logger"))).toBe(true);
  expect(opened.tools).not.toContain("Open Logger Settings");
  expect(opened.urls).toEqual([
    "https://github.com/Hyperloop-UPV/adj",
    "https://github.com/Hyperloop-UPV/software/issues/new/choose",
  ]);
});

test("Control Station menu switches modes and returns through the selector", async ({
  app,
}) => {
  test.setTimeout(60_000);

  const labels = await app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu()!;
    return {
      title: menu.items[0].label,
      items: menu.items[0]
        .submenu!.items.filter((item) => item.type !== "separator")
        .map((item) => item.label),
    };
  });
  expect(labels.title).toBe("Control Station");
  expect(labels.items[0]).toBe("Reload");
  expect(labels.items.slice(-2)).toEqual(["Return to Selector", "Quit"]);
  test.skip(
    !labels.items.includes("Logging View") ||
      !labels.items.includes("ADJ Viewer"),
    "Requires Logging and ADJ in the installed build",
  );

  await app.evaluate(({ BrowserWindow, Menu }) => {
    const menu = Menu.getApplicationMenu()!;
    const logs = BrowserWindow.getAllWindows().find((window) =>
      window.webContents.getURL().includes("/log-viewer/"),
    )!;
    const item = menu.items[0].submenu!.items.find(
      (item) => item.label === "Logging View",
    )!;
    item.click(item, logs, {} as never);
  });
  await expect
    .poll(() =>
      app
        .windows()
        .filter((window) => !window.isClosed())
        .map((window) => window.url()),
    )
    .toEqual([expect.stringContaining("/logging-view/index.html")]);

  // Exercise renderer navigation: this fails if the old main window cleared
  // the replacement's reference when it closed.
  const logging = app
    .windows()
    .find((window) => window.url().includes("/logging-view/index.html"))!;
  await logging.waitForLoadState("domcontentloaded");
  await openAdjFromRenderer(logging);

  await app.evaluate(({ BrowserWindow, Menu }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const item = Menu.getApplicationMenu()!.items[0].submenu!.items.find(
      (item) => item.label === "Return to Selector",
    )!;
    item.click(item, window, {} as never);
  });
  await expect
    .poll(() =>
      app
        .windows()
        .some((window) => window.url().includes("/mode-selector/index.html")),
    )
    .toBe(true);
  const selector = app
    .windows()
    .find((window) => window.url().includes("/mode-selector/index.html"))!;
  await selector
    .getByRole("button", { name: "Logging View", exact: true })
    .click();
  await expect
    .poll(() =>
      app
        .windows()
        .filter((window) => !window.isClosed())
        .map((window) => window.url()),
    )
    .toEqual([expect.stringContaining("/logging-view/index.html")]);
  const replacement = app
    .windows()
    .find((window) => window.url().includes("/logging-view/index.html"))!;
  await replacement.waitForLoadState("domcontentloaded");
  await openAdjFromRenderer(replacement);
});
