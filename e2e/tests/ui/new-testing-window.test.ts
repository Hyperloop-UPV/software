import type { ElectronApplication } from "@playwright/test";
import { expect, test } from "../../fixtures/electron";

async function invokeNewWindow(app: ElectronApplication, view = "testing") {
  const opened = app.waitForEvent("window");
  await app.evaluate(({ BrowserWindow, Menu }, view) => {
    const menu = Menu.getApplicationMenu()!;
    menu.items
      .find((item) => item.label === "Window")!
      .submenu!.emit("menu-will-show");
    const item = menu.getMenuItemById(`new-${view}-window`)!;
    if (!item.visible || !item.enabled)
      throw new Error(`New ${view} window is not available`);
    item.click(item, BrowserWindow.getFocusedWindow()!, {} as never);
  }, view);
  const window = await opened;
  await expect(window).toHaveURL(new RegExp(`/${view}-view/index\\.html$`));
  if (view === "testing")
    await expect(window.getByTestId("mode-badge")).toHaveAttribute(
      "data-mode",
      "active",
      { timeout: 15_000 },
    );
  return window;
}

for (const mode of ["testing", "competition"]) {
  test(`New Testing Window opens additional instances from ${mode} without replacing the main window`, async ({
    app,
  }) => {
    test.setTimeout(60_000);
    if (mode === "competition") {
      const available = await app.evaluate(({ Menu }) =>
        Menu.getApplicationMenu()!.items[0].submenu!.items.some(
          (item) => item.label === "Competition View",
        ),
      );
      test.skip(!available, "Competition View is not packaged");
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
    }
    const main = app
      .windows()
      .find((window) => window.url().includes(`/${mode}-view/index.html`))!;
    const mainHandle = await app.browserWindow(main);
    const mainId = await mainHandle.evaluate((window) => window.id);
    const logs = app
      .windows()
      .find((window) => window.url().includes("/log-viewer/index.html"))!;
    await main.evaluate(() => {
      document.body.dataset.windowInstance = "original";
    });

    const first = await invokeNewWindow(app);
    const second = await invokeNewWindow(app);
    const competition =
      mode === "competition" ? await invokeNewWindow(app, "competition") : null;
    expect(first).not.toBe(second);
    expect(main.isClosed()).toBe(false);
    expect(logs.isClosed()).toBe(false);
    if (competition) {
      expect(competition.url()).toContain("/competition-view/index.html");
      expect(
        await competition.evaluate(() => document.body.dataset.windowInstance),
      ).toBeUndefined();
      await competition.close();
      expect(main.isClosed()).toBe(false);
      expect(second.isClosed()).toBe(false);
      expect(logs.isClosed()).toBe(false);
    }
    expect(main.url()).toContain(`/${mode}-view/index.html`);
    expect(
      await first.evaluate(() => document.body.dataset.windowInstance),
    ).toBeUndefined();
    expect(
      await main.evaluate(() => document.body.dataset.windowInstance),
    ).toBe("original");

    // The global main-window pointer still targets the original window.
    const focusTarget = await app.evaluate(
      ({ BrowserWindow, Menu }, mainId) => {
        const main = BrowserWindow.fromId(mainId)!;
        const originalFocus = main.focus;
        let focusTarget: number | undefined;
        main.focus = () => {
          focusTarget = main.id;
          originalFocus.call(main);
        };
        const item = Menu.getApplicationMenu()!
          .items.find((item) => item.label === "Window")!
          .submenu!.items.find((item) => item.label === "Show Main Window")!;
        try {
          item.click(item, undefined, {} as never);
        } finally {
          main.focus = originalFocus;
        }
        return focusTarget;
      },
      mainId,
    );
    // Check the target, not OS focus-stealing prevention on the test desktop.
    expect(focusTarget).toBe(mainId);
    await first.close();
    expect(main.isClosed()).toBe(false);
    expect(second.isClosed()).toBe(false);
    expect(logs.isClosed()).toBe(false);

    // The existing transition keeps old windows hidden until a new mode is chosen.
    await app.evaluate(({ app }) => {
      app.emit("return-to-selector");
    });
    await expect
      .poll(
        () =>
          main.isClosed() ||
          app
            .windows()
            .some((window) =>
              window.url().includes("/mode-selector/index.html"),
            ),
        { timeout: 15_000 },
      )
      .toBe(true);
    if (!main.isClosed()) {
      const selector = app
        .windows()
        .find((window) => window.url().includes("/mode-selector/index.html"))!;
      await selector
        .getByRole("button", { name: "Testing View", exact: true })
        .click();
    }
    await expect
      .poll(() => main.isClosed() && second.isClosed(), { timeout: 15_000 })
      .toBe(true);
  });
}

test("New Testing Window is hidden in Logging View", async ({ app }) => {
  const available = await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()!.items[0].submenu!.items.some(
      (item) => item.label === "Logging View",
    ),
  );
  test.skip(!available, "Logging View is not packaged");
  await app.evaluate(({ BrowserWindow, Menu }) => {
    const item = Menu.getApplicationMenu()!.items[0].submenu!.items.find(
      (item) => item.label === "Logging View",
    )!;
    item.click(item, BrowserWindow.getAllWindows()[0], {} as never);
  });
  await expect
    .poll(
      () =>
        app
          .windows()
          .some((window) => window.url().includes("/logging-view/index.html")),
      { timeout: 15_000 },
    )
    .toBe(true);
  const state = await app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu()!;
    menu.items
      .find((item) => item.label === "Window")!
      .submenu!.emit("menu-will-show");
    const item = menu.getMenuItemById("new-testing-window")!;
    const competition = menu.getMenuItemById("new-competition-window")!;
    return {
      visible: item.visible,
      enabled: item.enabled,
      competitionVisible: competition.visible,
    };
  });
  expect(state).toEqual({
    visible: false,
    enabled: false,
    competitionVisible: false,
  });
});
