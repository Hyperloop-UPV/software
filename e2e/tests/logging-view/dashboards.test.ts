import { expect, test, type Page } from "@playwright/test";

async function openSession(page: Page, folder = "demo") {
  await page.evaluate(async (folderName) => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    await useStore.getState().openSession(
      ["velocity", "position", "temperature"].map((name, index) => ({
        name: `${name}.csv`,
        webkitRelativePath: `${folderName}/data/LCU/${name}.csv`,
        text: async () =>
          `0,LCU,backend,${index}\n50000,LCU,backend,${index + 2}\n100000,LCU,backend,${index + 1}`,
      })),
    );
  }, folder);
}

async function chooseSignal(page: Page, name: string) {
  const sidebar = page.locator('[data-slot="sidebar-content"]');
  const board = sidebar.getByRole("button", { name: /^LCU/ });
  if ((await board.getAttribute("data-state")) !== "open") await board.click();
  await sidebar.getByText(name, { exact: true }).click();
}

// Two frames is what the existing wheel assertions use to let ECharts repaint
// and the rAF-coalesced store commit land.
async function flushFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

// Puts `name` on a plot. Selecting in the sidebar only marks the signal; the
// pane menu is what assigns it.
async function plotSignals(page: Page, names: string[], pane = 1) {
  // Starts from an empty selection so the count in the menu item's label is
  // known. The header's "Clear selection" button does not settle before the
  // next click, so go through the store action it calls.
  await page.evaluate(async () => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    useStore.getState().clearNormalSeries();
  });
  for (const name of names) await chooseSignal(page, name);
  await page
    .getByRole("region", { name: `Chart panel ${pane}`, exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menu", { name: `Chart ${pane} actions` })
    .getByRole("menuitem", { name: /^Add \d+ selected measurements?$/ })
    .click();
}

const addSignalToPane = (page: Page, name: string, pane = 1) =>
  plotSignals(page, [name], pane);

async function applyWindow(page: Page, start: string, end: string) {
  await page
    .getByRole("spinbutton", { name: "Start time (s)", exact: true })
    .fill(start);
  await page
    .getByRole("spinbutton", { name: "End time (s)", exact: true })
    .fill(end);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
}

const paneWindow = (page: Page, pane = 1) =>
  page
    .getByRole("region", { name: `Chart panel ${pane}`, exact: true })
    .getByTitle(/time window for this plot|its own time window/);

test.beforeEach(async ({ page }) => {
  await page.goto("/#/normal");
  await expect(
    page.getByRole("heading", { name: "Open a logging session" }),
  ).toBeVisible();
  await openSession(page);
  await page
    .getByRole("button", {
      name: "Expand layout and time controls",
      exact: true,
    })
    .click();
});

// Recent sessions are an Electron-only feature: the browser's folder picker
// never yields a path. This stubs the three bridge methods the renderer needs
// so the list can be exercised against the dev server.
async function stubElectronBridge(page: Page) {
  await page.addInitScript(() => {
    const folder = "/logs/demo";
    const entries = ["velocity", "position", "temperature"].map(
      (name) => `data/LCU/${name}.csv`,
    );
    const values: Record<string, number> = {
      velocity: 0,
      position: 1,
      temperature: 2,
    };
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      switchView: async (view: string) => view,
      selectFolder: async () => folder,
      listSessionFiles: async () => ({ folderName: "demo", entries }),
      readSessionFile: async (_dir: string, relative: string) => {
        const name = relative.split("/").pop()!.replace(".csv", "");
        const index = values[name] ?? 0;
        return `0,LCU,backend,${index}\n50000,LCU,backend,${index + 2}\n100000,LCU,backend,${index + 1}`;
      },
    };
  });
}

test("recent sessions reopen a folder by path", async ({ page }) => {
  await stubElectronBridge(page);
  // A full reload is what applies the init script and drops the session the
  // beforeEach opened (session state is not persisted).
  await page.reload();
  // Nothing opened yet, so nothing to recall.
  await expect(
    page.getByRole("region", { name: "Recent sessions", exact: true }),
  ).toHaveCount(0);

  // The native dialog path records the session, so closing it leaves a recent.
  await page.getByRole("button", { name: "or browse…", exact: true }).click();
  await expect(page.locator("header")).toContainText("demo");
  await page
    .getByRole("button", { name: "Close session", exact: true })
    .click();
  const recent = page.getByRole("region", {
    name: "Recent sessions",
    exact: true,
  });
  await expect(recent).toBeVisible();
  await expect(recent).toContainText("/logs/demo");

  // One click reopens it, and its CSVs are readable through the bridge.
  await recent.getByRole("button", { name: "Open demo", exact: true }).click();
  await expect(page.locator("header")).toContainText("demo · 0 selected");
  await chooseSignal(page, "velocity");
  await page
    .getByRole("region", { name: "Chart panel 1", exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menu", { name: "Chart 1 actions" })
    .getByRole("menuitem", { name: "Add 1 selected measurement", exact: true })
    .click();
  await expect(page.locator("canvas")).toHaveCount(1);

  // It survives a reload, and can be forgotten.
  await page
    .getByRole("button", { name: "Close session", exact: true })
    .click();
  await page.reload();
  await expect(recent).toBeVisible();
  await recent
    .getByRole("button", { name: "Forget demo", exact: true })
    .click();
  await expect(recent).toHaveCount(0);
});

test("dashboards keep separate signals, layout, panel sizes and time settings", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Selecting a measurement marks it; a plot is what draws it, so each chart
  // needs its own pane.
  await plotSignals(page, ["velocity"]);
  // The sidebar's selection bar offers a "New plot" too, so scope to the bar.
  await page
    .getByRole("group", { name: "Analysis controls", exact: true })
    .getByRole("button", { name: "New plot", exact: true })
    .click();
  await plotSignals(page, ["position"], 2);
  await expect(page.locator("canvas")).toHaveCount(2);
  // Both selected again: the assertions below are about per-dashboard scope.
  await chooseSignal(page, "velocity");
  await expect(page.locator("header")).toContainText("2 selected");
  await page.getByRole("button", { name: "Rows", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Start time (s)", exact: true })
    .fill("10");
  await page
    .getByRole("spinbutton", { name: "End time (s)", exact: true })
    .fill("50");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("combobox", { name: "Time unit" }).selectOption("ms");
  await page
    .getByRole("button", {
      name: "Hide LCU / velocity in chart 1",
      exact: true,
    })
    .click();
  const divider = page.getByRole("separator");
  await divider.focus();
  await divider.press("ArrowUp");
  const panelSize = await page
    .getByRole("region", { name: "Chart panel 1", exact: true })
    .boundingBox();
  const tabBar = await page
    .getByRole("tablist", { name: "Dashboards" })
    .boundingBox();
  const controls = await page
    .getByRole("group", { name: "Analysis controls", exact: true })
    .boundingBox();
  expect(tabBar!.y + tabBar!.height).toBeLessThanOrEqual(controls!.y);

  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Dashboard 2", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Empty plot", { exact: true })).toBeVisible();
  await expect(page.locator("header")).toContainText("0 selected");
  await plotSignals(page, ["temperature"]);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(
    page.getByRole("spinbutton", { name: "Start time (s)", exact: true }),
  ).toHaveValue("0");
  await page.getByRole("button", { name: "Single", exact: true }).click();
  await page
    .getByRole("button", { name: "Zoom in comparison", exact: true })
    .click();

  await page.getByRole("tab", { name: "Dashboard", exact: true }).click();
  await expect(page.locator("header")).toContainText("2 selected");
  await expect(
    page.getByRole("spinbutton", { name: "Start time (ms)", exact: true }),
  ).toHaveValue("10000");
  await expect(
    page.getByRole("spinbutton", { name: "End time (ms)", exact: true }),
  ).toHaveValue("50000");
  await expect(
    page.getByRole("button", {
      name: "Show LCU / velocity in chart 1",
      exact: true,
    }),
  ).toBeVisible();
  const restoredSize = await page
    .getByRole("region", { name: "Chart panel 1", exact: true })
    .boundingBox();
  expect(Math.abs(restoredSize!.height - panelSize!.height)).toBeLessThan(2);

  await page.getByRole("tab", { name: "Dashboard 2", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Single", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("spinbutton", { name: "Start time (s)", exact: true }),
  ).toHaveValue("25");
  await expect(
    page.getByRole("spinbutton", { name: "End time (s)", exact: true }),
  ).toHaveValue("75");
  await page.screenshot({ path: testInfo.outputPath("dashboards.png") });
  expect(errors).toEqual([]);
});

test("tabs support renaming, keyboard switching, closing and overflow", async ({
  page,
}, testInfo) => {
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  const second = page.getByRole("tab", { name: "Dashboard 2", exact: true });
  await second.focus();
  await second.press("F2");
  await page
    .getByRole("textbox", { name: "Dashboard name", exact: true })
    .fill("Thermal");
  await page
    .getByRole("textbox", { name: "Dashboard name", exact: true })
    .press("Enter");
  const thermal = page.getByRole("tab", { name: "Thermal", exact: true });
  await expect(thermal).toBeFocused();
  await thermal.press("F2");
  await page
    .getByRole("textbox", { name: "Dashboard name", exact: true })
    .fill("Cancelled name");
  await page
    .getByRole("textbox", { name: "Dashboard name", exact: true })
    .press("Escape");
  await expect(thermal).toBeFocused();
  await thermal.press("ArrowLeft");
  await expect(
    page.getByRole("tab", { name: "Dashboard", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Close Thermal", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Dashboard", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Close Dashboard", exact: true })
    .click();
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(page.getByText("Empty plot", { exact: true })).toBeVisible();
  for (let i = 0; i < 8; i++)
    await page
      .getByRole("button", { name: "New dashboard", exact: true })
      .click();
  await page.setViewportSize({ width: 600, height: 850 });
  await expect(
    page.getByRole("button", { name: "New dashboard", exact: true }),
  ).toBeInViewport();
  await expect(page.getByRole("tab", { selected: true })).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("dashboards-compact.png"),
  });
});

test("clearing, mode switching and a new session keep selections scoped", async ({
  page,
}) => {
  await plotSignals(page, ["velocity"]);
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await chooseSignal(page, "temperature");
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(page.getByText("Empty plot", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Dashboard", exact: true }).click();
  await expect(page.locator("header")).toContainText("1 selected");
  await page.getByRole("button", { name: "Simple", exact: true }).click();
  await expect(page).toHaveURL(/#\/simple$/);
  await expect(
    page.getByRole("heading", { name: "Logging View", exact: true }),
  ).toBeVisible();
  await chooseSignal(page, "position");
  await page.getByRole("button", { name: "Normal", exact: true }).click();
  await expect(page).toHaveURL(/#\/normal$/);
  await expect(page.getByRole("tab")).toHaveCount(2);
  // The plot survives the round trip through Simple mode. Panes are titled
  // "Plot", not after their signal, so the trace chip is what names it.
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Chart panel 1", exact: true }),
  ).toContainText("LCU / velocity");
  await expect(page.locator("header")).toContainText("1 selected");
  await openSession(page, "another-session");
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(page.locator("header")).toContainText(
    "another-session · 0 selected",
  );
  await expect(page.getByText("Empty plot", { exact: true })).toBeVisible();
});

test("tab editor keeps text separate and supports colors and individual reordering", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const first = page.getByRole("tab", { name: "Dashboard", exact: true });
  await first.dblclick();
  const editor = page.getByRole("form", { name: "Dashboard tab settings" });
  await expect(editor).toBeVisible();
  const name = editor.getByRole("textbox", {
    name: "Dashboard name",
    exact: true,
  });
  await expect(name).toBeFocused();
  await expect(page.getByRole("tablist").getByRole("textbox")).toHaveCount(0);
  const tabBox = await first.boundingBox();
  const inputBox = await name.boundingBox();
  expect(inputBox!.y).toBeGreaterThanOrEqual(tabBox!.y + tabBox!.height);
  await name.fill("Power and cooling");
  await editor
    .getByRole("button", { name: "Blue tab color", exact: true })
    .click();
  await page.screenshot({ path: testInfo.outputPath("tab-editor.png") });
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  const renamed = page.getByRole("tab", {
    name: "Power and cooling",
    exact: true,
  });
  await expect(renamed).toBeFocused();
  await expect(renamed).toHaveCSS("box-shadow", /rgb\(59, 130, 246\)/);
  await renamed.press("F2");
  await editor.getByLabel("Custom tab color", { exact: true }).fill("#14b8a6");
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(renamed).toHaveCSS("box-shadow", /rgb\(20, 184, 166\)/);

  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await renamed.dblclick();
  await editor
    .getByRole("combobox", { name: "Tab position", exact: true })
    .selectOption("2");
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  const tabNames = () =>
    page
      .getByRole("tab")
      .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("aria-label")));
  expect(await tabNames()).toEqual([
    "Dashboard",
    "Dashboard 2",
    "Power and cooling",
  ]);
  await expect(renamed).toHaveAttribute("aria-selected", "true");
  await renamed.press("Alt+Shift+ArrowLeft");
  await renamed.press("Alt+Shift+ArrowLeft");
  expect(await tabNames()).toEqual([
    "Power and cooling",
    "Dashboard",
    "Dashboard 2",
  ]);
  const last = page.getByRole("tab", { name: "Dashboard 2", exact: true });
  const lastBox = await last.boundingBox();
  await renamed.dragTo(last, {
    targetPosition: { x: lastBox!.width - 5, y: lastBox!.height / 2 },
  });
  await expect
    .poll(tabNames)
    .toEqual(["Dashboard", "Dashboard 2", "Power and cooling"]);
  await page.screenshot({
    path: testInfo.outputPath("reordered-colored-tabs.png"),
  });
  expect(errors).toEqual([]);
});

test("locking protects tab and dashboard state until explicitly unlocked", async ({
  page,
}, testInfo) => {
  await plotSignals(page, ["velocity", "position"]);
  await page.getByRole("button", { name: "Rows", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Start time (s)", exact: true })
    .fill("10");
  await page
    .getByRole("spinbutton", { name: "End time (s)", exact: true })
    .fill("50");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  const first = page.getByRole("tab", { name: "Dashboard", exact: true });
  await first.dblclick();
  const editor = page.getByRole("form", { name: "Dashboard tab settings" });
  await editor
    .getByRole("checkbox", { name: "Lock dashboard", exact: true })
    .check();
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    page.getByText("Dashboard locked · Unlock in tab settings to edit", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rows", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("spinbutton", { name: "Start time (s)", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Time unit", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Zoom in comparison", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Clear selection", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Configure chart 1", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Hide LCU / velocity in chart 1",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Close Dashboard", exact: true }),
  ).toBeDisabled();
  for (const checkbox of await page
    .locator('[data-slot="sidebar-content"]')
    .getByRole("checkbox")
    .all()) {
    await expect(checkbox).toBeDisabled();
  }
  await expect(first.locator("..")).toHaveAttribute("draggable", "false");
  const protectedState = await page.evaluate(async () => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    const state = useStore.getState();
    const id = state.activeNormalDashboardId;
    const before = JSON.stringify(state.normalDashboards);
    state.toggleNormalSeries("LCU/temperature");
    state.clearNormalSeries();
    state.renameNormalDashboard(id, "Should not change");
    state.moveNormalDashboard(id, 1);
    state.updateNormalDashboardSettings(id, (settings: unknown) => ({
      ...(settings as object),
      range: { start: 0, end: 100 },
    }));
    state.configureNormalDashboard(id, {
      name: "Should not change",
      color: "#ef4444",
      locked: true,
      position: 1,
    });
    state.closeNormalDashboard(id);
    return before === JSON.stringify(useStore.getState().normalDashboards);
  });
  expect(protectedState).toBe(true);
  const chart = page
    .getByLabel("Interactive signal chart", { exact: true })
    .first();
  await chart.hover();
  await page.mouse.wheel(0, -300);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(
    page.getByRole("spinbutton", { name: "Start time (s)", exact: true }),
  ).toHaveValue("10");
  await expect(
    page.getByRole("spinbutton", { name: "End time (s)", exact: true }),
  ).toHaveValue("50");
  await first.press("Alt+Shift+ArrowRight");
  await expect(page.getByRole("tab").first()).toHaveAttribute(
    "aria-label",
    "Dashboard",
  );
  await page.screenshot({ path: testInfo.outputPath("locked-dashboard.png") });

  await page.getByRole("tab", { name: "Dashboard 2", exact: true }).click();
  await chooseSignal(page, "temperature");
  await expect(
    page.getByRole("button", { name: "Rows", exact: true }),
  ).toBeEnabled();
  await first.dblclick();
  await expect(
    editor.getByRole("textbox", { name: "Dashboard name", exact: true }),
  ).toBeDisabled();
  await expect(
    editor.getByRole("button", { name: "Blue tab color", exact: true }),
  ).toBeDisabled();
  await expect(
    editor.getByRole("combobox", { name: "Tab position", exact: true }),
  ).toBeDisabled();
  await editor
    .getByRole("checkbox", { name: "Lock dashboard", exact: true })
    .uncheck();
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Start time (s)", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Clear selection", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Close Dashboard", exact: true }),
  ).toBeEnabled();
  await chooseSignal(page, "temperature");
  await expect(page.locator("header")).toContainText("3 selected");
});

test("uncolored tabs have visible shapes and can move to both ends of the bar", async ({
  page,
}, testInfo) => {
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  const first = page.getByRole("tab", { name: "Dashboard", exact: true });
  const middle = page.getByRole("tab", { name: "Dashboard 2", exact: true });
  const last = page.getByRole("tab", { name: "Dashboard 3", exact: true });
  const inactiveStyle = await first.evaluate((tab) => {
    const style = getComputedStyle(tab);
    return {
      borderColor: style.borderTopColor,
      borderWidth: style.borderTopWidth,
      background: style.backgroundColor,
      accent: style.boxShadow,
    };
  });
  expect(inactiveStyle.borderWidth).toBe("1px");
  expect(inactiveStyle.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(inactiveStyle.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(inactiveStyle.accent).not.toBe("none");
  await expect(last).toHaveCSS("font-weight", "600");
  await page.screenshot({ path: testInfo.outputPath("uncolored-tabs.png") });
  const bar = page
    .getByRole("tablist", { name: "Dashboards", exact: true })
    .locator("..");
  const rect = await bar.boundingBox();
  const tabNames = () =>
    page
      .getByRole("tab")
      .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("aria-label")));
  await middle.dragTo(bar, { targetPosition: { x: 2, y: rect!.height / 2 } });
  await expect
    .poll(tabNames)
    .toEqual(["Dashboard 2", "Dashboard", "Dashboard 3"]);
  await middle.dragTo(bar, {
    targetPosition: { x: rect!.width - 2, y: rect!.height / 2 },
  });
  await expect
    .poll(tabNames)
    .toEqual(["Dashboard", "Dashboard 3", "Dashboard 2"]);

  const editor = page.getByRole("form", {
    name: "Dashboard tab settings",
    exact: true,
  });
  await middle.dblclick();
  await editor
    .getByRole("button", { name: "Move to first", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect
    .poll(tabNames)
    .toEqual(["Dashboard 2", "Dashboard", "Dashboard 3"]);
  await middle.dblclick();
  await editor
    .getByRole("button", { name: "Move to last", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect
    .poll(tabNames)
    .toEqual(["Dashboard", "Dashboard 3", "Dashboard 2"]);
  await middle.press("Alt+Shift+Home");
  await expect
    .poll(tabNames)
    .toEqual(["Dashboard 2", "Dashboard", "Dashboard 3"]);
  await middle.press("Alt+Shift+End");
  await expect
    .poll(tabNames)
    .toEqual(["Dashboard", "Dashboard 3", "Dashboard 2"]);
  await expect(middle).toHaveAttribute("aria-selected", "true");
  for (let index = 0; index < 5; index++) {
    await page
      .getByRole("button", { name: "New dashboard", exact: true })
      .click();
  }
  await page.setViewportSize({ width: 600, height: 850 });
  const overflowTab = page.getByRole("tab", {
    name: "Dashboard 8",
    exact: true,
  });
  const compactBar = await bar.boundingBox();
  await overflowTab.dragTo(bar, {
    targetPosition: { x: 2, y: compactBar!.height / 2 },
  });
  await expect(page.getByRole("tab").first()).toHaveAttribute(
    "aria-label",
    "Dashboard 8",
  );
  await overflowTab.dragTo(bar, {
    targetPosition: { x: compactBar!.width - 2, y: compactBar!.height / 2 },
  });
  await expect(page.getByRole("tab").last()).toHaveAttribute(
    "aria-label",
    "Dashboard 8",
  );
  await expect(page.getByRole("tab")).toHaveCount(8);
  await expect(overflowTab).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("uncolored-tabs-overflow.png"),
  });
});

test("closing a tab asks for confirmation at four charts, including inactive tabs", async ({
  page,
}) => {
  await plotSignals(page, ["velocity"]);
  await expect(page.locator("canvas")).toHaveCount(1);
  for (let index = 0; index < 2; index++) {
    await page
      .getByRole("button", { name: "Split chart 1 into columns", exact: true })
      .click();
  }
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    3,
  );
  await page
    .getByRole("button", { name: "Close Dashboard", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(
    page.getByRole("tab", { name: "Dashboard", exact: true }),
  ).toBeVisible();

  await plotSignals(page, ["velocity"]);
  await expect(page.locator("canvas")).toHaveCount(1);
  for (let index = 0; index < 3; index++) {
    await page
      .getByRole("button", { name: "Split chart 1 into columns", exact: true })
      .click();
  }
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    4,
  );
  const close = page.getByRole("button", {
    name: "Close Dashboard",
    exact: true,
  });
  const dialog = page.getByRole("alertdialog", {
    name: "Close Dashboard?",
    exact: true,
  });
  await close.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("4 charts");
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(close).toBeFocused();
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    4,
  );
  await close.click();
  await dialog.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    4,
  );

  await page
    .getByRole("button", { name: "Split chart 1 into columns", exact: true })
    .click();
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    5,
  );
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await close.click();
  await expect(dialog).toContainText("5 charts");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Dashboard 2", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await close.click();
  await dialog.getByRole("button", { name: "Close tab", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Dashboard", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(
    page.getByRole("tab", { name: "Dashboard 2", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("right-click menus duplicate tabs and act on plots", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const tabNames = () =>
    page
      .getByRole("tab")
      .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("aria-label")));

  // Build a dashboard worth copying: two plots, one holding a measurement.
  await chooseSignal(page, "velocity");
  await page
    .getByRole("button", { name: "Split chart 1 into columns", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Chart panel 1", exact: true })
    .click({ button: "right" });
  const paneMenu = page.getByRole("menu", { name: "Chart 1 actions" });
  await expect(paneMenu).toBeVisible();
  await paneMenu
    .getByRole("menuitem", { name: "Add 1 selected measurement", exact: true })
    .click();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    2,
  );

  // The settings popover must survive the menu closing behind it. Radix
  // restores focus to whatever was focused when the menu opened, in a timeout
  // that runs after the exit animation, so the bug only reproduces when that
  // element is real — hence the click first.
  const config = page.getByRole("textbox", {
    name: "Search signals for chart 1",
    exact: true,
  });
  for (const open of [
    async () => {
      await page
        .getByRole("region", { name: "Chart panel 1", exact: true })
        .click({ button: "right" });
      await paneMenu
        .getByRole("menuitem", {
          name: "Signals, units and scale",
          exact: true,
        })
        .click();
    },
    async () => {
      await page
        .getByRole("button", { name: "Configure chart 1", exact: true })
        .click();
    },
  ]) {
    await page
      .getByRole("button", { name: "Zoom in comparison", exact: true })
      .click();
    await open();
    await expect(config).toBeVisible();
    // Past the exit animation and the focus-restore timeout behind it.
    await page.waitForTimeout(400);
    await flushFrames(page);
    await expect(config).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          !!document.activeElement?.closest('[data-slot="popover-content"]'),
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(config).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Reset zoom", exact: true })
    .first()
    .click();

  // Duplicate from the tab menu: copy lands right after the original, active.
  const first = page.getByRole("tab", { name: "Dashboard", exact: true });
  await first.click({ button: "right" });
  const tabMenu = page.getByRole("menu", { name: "Dashboard tab actions" });
  await expect(tabMenu).toBeVisible();
  await tabMenu
    .getByRole("menuitem", { name: "Duplicate", exact: true })
    .click();
  const copy = page.getByRole("tab", { name: "Dashboard (copy)", exact: true });
  await expect(copy).toHaveAttribute("aria-selected", "true");
  // Radix keeps the page aria-hidden while the menu unmounts, so poll.
  await expect.poll(tabNames).toEqual(["Dashboard", "Dashboard (copy)"]);
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    2,
  );
  await expect(page.locator("canvas")).toHaveCount(1);

  // The copy is independent: closing one of its plots leaves the original.
  await page
    .getByRole("region", { name: "Chart panel 2", exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menu", { name: "Chart 2 actions" })
    .getByRole("menuitem", { name: "Close plot", exact: true })
    .click();
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    1,
  );
  await first.click();
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    2,
  );

  // A second duplicate gets the next free copy name.
  await first.click({ button: "right" });
  await tabMenu
    .getByRole("menuitem", { name: "Duplicate", exact: true })
    .click();
  await expect
    .poll(tabNames)
    .toEqual(["Dashboard", "Dashboard (copy 2)", "Dashboard (copy)"]);

  // Workspace background menu drives layout and the statistics panel.
  await page
    .getByLabel("Signal analysis workspace", { exact: true })
    // Inside the workspace's 12px padding band, clear of the panes and of the
    // sidebar's toggle handle at the left edge.
    .click({ button: "right", position: { x: 300, y: 4 } });
  const workspaceMenu = page.getByRole("menu", { name: "Workspace actions" });
  await expect(workspaceMenu).toBeVisible();
  await workspaceMenu
    .getByRole("menuitemcheckbox", { name: "Window statistics", exact: true })
    .click();
  await expect(
    page.getByRole("region", {
      name: "Visible window statistics",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Customize statistics columns" })
    .click();
  await page.getByRole("checkbox", { name: "Minimum" }).click();
  await expect(
    page.getByRole("columnheader", { name: "Minimum", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close window statistics" }).click();
  await expect(
    page.getByRole("region", {
      name: "Visible window statistics",
      exact: true,
    }),
  ).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("context-menus.png") });
  expect(errors).toEqual([]);
});

test("the tab menu moves, locks and bulk-closes tabs", async ({ page }) => {
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  const tabNames = () =>
    page
      .getByRole("tab")
      .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("aria-label")));
  const third = page.getByRole("tab", { name: "Dashboard 3", exact: true });
  const tabMenu = page.getByRole("menu", { name: "Dashboard tab actions" });

  await third.click({ button: "right" });
  await tabMenu
    .getByRole("menuitem", { name: "Move to first", exact: true })
    .click();
  await expect
    .poll(tabNames)
    .toEqual(["Dashboard 3", "Dashboard", "Dashboard 2"]);

  // Locking through the menu disables the mutating items on the next open.
  await third.click({ button: "right" });
  await tabMenu.getByRole("menuitem", { name: "Lock", exact: true }).click();
  await third.click({ button: "right" });
  await expect(
    tabMenu.getByRole("menuitem", { name: "Close", exact: true }),
  ).toBeDisabled();
  await expect(
    tabMenu.getByRole("menuitem", { name: "Move to last", exact: true }),
  ).toBeDisabled();
  await tabMenu.getByRole("menuitem", { name: "Unlock", exact: true }).click();

  // "Close other tabs" skips nothing here and needs no confirmation (0 charts
  // each, under the four-chart threshold).
  await third.click({ button: "right" });
  await tabMenu
    .getByRole("menuitem", { name: "Close other tabs", exact: true })
    .click();
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(third).toBeVisible();

  // The four-chart confirmation covers the menu's Close item too.
  const split = page.getByRole("button", {
    name: "Split chart 1 into columns",
    exact: true,
  });
  const panels = page.getByRole("region", { name: /^Chart panel / });
  for (let index = 0; index < 3; index++) await split.click();
  await expect(panels).toHaveCount(4);
  await third.click({ button: "right" });
  await tabMenu.getByRole("menuitem", { name: "Close", exact: true }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Close Dashboard 3?",
    exact: true,
  });
  await expect(dialog).toContainText("4 charts");
  await dialog.getByRole("button", { name: "Close tab", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Dashboard", exact: true }),
  ).toBeVisible();

  // And a bulk close asks once for the whole batch.
  const newDashboard = page.getByRole("button", {
    name: "New dashboard",
    exact: true,
  });
  await newDashboard.click();
  await newDashboard.click();
  await page.getByRole("tab", { name: "Dashboard 2", exact: true }).click();
  for (let index = 0; index < 3; index++) await split.click();
  await expect(panels).toHaveCount(4);
  await page
    .getByRole("tab", { name: "Dashboard", exact: true })
    .click({ button: "right" });
  await tabMenu
    .getByRole("menuitem", { name: "Close other tabs", exact: true })
    .click();
  const bulk = page.getByRole("alertdialog", {
    name: "Close 2 tabs?",
    exact: true,
  });
  await expect(bulk).toContainText("5 charts");
  await bulk.getByRole("button", { name: "Close tabs", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(
    page.getByRole("tab", { name: "Dashboard", exact: true }),
  ).toBeVisible();
});

test("a duplicate shares no node ids and keeps its panel sizes", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    const store = useStore.getState();
    const id = store.activeNormalDashboardId;
    // Two plots, so the tree gains a split node, then give that split a
    // non-default divider position — the part a naive copy would lose.
    store.addNormalPlot(["LCU/velocity"]);
    store.addNormalPlot(["LCU/position"]);
    const splitId = useStore
      .getState()
      .normalDashboards.find((item: { id: string }) => item.id === id).settings
      .layoutState.tree.id;
    store.updateNormalDashboardSettings(id, (settings: object) => ({
      ...settings,
      panelSizes: {
        [splitId]: { [`${splitId}-first`]: 0.7, [`${splitId}-second`]: 0.3 },
      },
    }));

    const copyId = store.duplicateNormalDashboard(id);
    const dashboards = useStore.getState().normalDashboards;
    const find = (target: string) =>
      dashboards.find((item: { id: string }) => item.id === target);
    const source = find(id);
    const copy = find(copyId);
    const nodeIds = (
      node: { id: string; type: string; first?: object; second?: object },
      out: string[] = [],
    ) => {
      out.push(node.id);
      if (node.type === "split") {
        nodeIds(node.first, out);
        nodeIds(node.second, out);
      }
      return out;
    };
    const sourceIds = nodeIds(source.settings.layoutState.tree);
    const copyIds = nodeIds(copy.settings.layoutState.tree);
    const keys = Object.keys(copy.settings.panelSizes);
    return {
      shared: copyIds.filter((node: string) => sourceIds.includes(node)),
      keysAreOwnNodes: keys.every((key) => copyIds.includes(key)),
      innerKeys: keys
        .flatMap((key) => Object.keys(copy.settings.panelSizes[key]))
        .sort(),
      expectedInnerKeys: keys
        .flatMap((key) => [`${key}-first`, `${key}-second`])
        .sort(),
      sizes: keys.flatMap((key) =>
        Object.values(copy.settings.panelSizes[key]),
      ),
      names: dashboards.map((item: { name: string }) => item.name),
      sourceSignals: source.settings.layoutState.ids,
      copySignals: copy.settings.layoutState.ids,
    };
  });

  expect(result.shared).toEqual([]);
  expect(result.keysAreOwnNodes).toBe(true);
  expect(result.innerKeys).toEqual(result.expectedInnerKeys);
  expect(result.sizes).toEqual([0.7, 0.3]);
  expect(result.copySignals).toEqual(result.sourceSignals);
  expect(result.names).toEqual(["Dashboard", "Dashboard (copy)"]);
});

test("default dashboard names reset for the only tab and reuse free names", async ({
  page,
}) => {
  for (let index = 0; index < 3; index++) {
    await expect(
      page.getByRole("tab", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close Dashboard", exact: true })
      .click();
    await expect(page.getByRole("tab")).toHaveCount(1);
    await expect(
      page.getByRole("tab", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /^Dashboard \d+$/ }),
    ).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  const third = page.getByRole("tab", { name: "Dashboard 3", exact: true });
  const thirdId = await third.getAttribute("id");
  await page
    .getByRole("button", { name: "Close Dashboard 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  const reused = page.getByRole("tab", { name: "Dashboard 2", exact: true });
  await expect(reused).toHaveAttribute("aria-selected", "true");
  await expect(third).toHaveAttribute("id", thirdId!);
  await reused.press("F2");
  await page
    .getByRole("textbox", { name: "Dashboard name", exact: true })
    .fill("Thermal overview");
  await page
    .getByRole("textbox", { name: "Dashboard name", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Dashboard 2", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tab", { name: "Thermal overview", exact: true }),
  ).toBeVisible();
  const names = await page
    .getByRole("tab")
    .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("aria-label")));
  expect(new Set(names).size).toBe(names.length);
});

test("layout and time controls compact into the tab bar without resetting charts", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await plotSignals(page, ["velocity"]);
  // The sidebar's selection bar offers a "New plot" too, so scope to the bar.
  await page
    .getByRole("group", { name: "Analysis controls", exact: true })
    .getByRole("button", { name: "New plot", exact: true })
    .click();
  await plotSignals(page, ["position"], 2);
  await expect(page.locator("canvas")).toHaveCount(2);
  const canvas = await page.locator("canvas").first().elementHandle();
  const before = await page
    .getByRole("region", { name: "Chart panel 1", exact: true })
    .boundingBox();
  await page
    .getByRole("button", {
      name: "Compact layout and time controls",
      exact: true,
    })
    .click();
  const tabBar = page
    .getByRole("tablist", { name: "Dashboards", exact: true })
    .locator("..");
  const controls = page.getByRole("group", {
    name: "Analysis controls",
    exact: true,
  });
  await expect(
    tabBar.getByRole("group", { name: "Analysis controls", exact: true }),
  ).toBeVisible();
  const after = await page
    .getByRole("region", { name: "Chart panel 1", exact: true })
    .boundingBox();
  expect(after!.y).toBeLessThan(before!.y - 40);
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  await page
    .getByRole("button", { name: "Layout settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Rows", exact: true }).click();
  await page
    .getByRole("button", { name: "Time window settings", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Start time (s)", exact: true })
    .fill("10");
  await page
    .getByRole("spinbutton", { name: "End time (s)", exact: true })
    .fill("50");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Time unit", exact: true })
    .selectOption("ms");
  await page
    .getByRole("spinbutton", { name: "Start time (ms)", exact: true })
    .press("Escape");
  await expect(
    page.getByRole("form", { name: "Visible time window", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Time window settings", exact: true }),
  ).toContainText("10,000–50,000 ms");
  await page.screenshot({ path: testInfo.outputPath("compact-tab-bar.png") });

  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await plotSignals(page, ["temperature"]);
  await expect(
    page.getByRole("button", { name: "Time window settings", exact: true }),
  ).toContainText("0–100 s");
  await page.getByRole("tab", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Time window settings", exact: true }),
  ).toContainText("10,000–50,000 ms");
  await page
    .getByRole("button", {
      name: "Expand layout and time controls",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Rows", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("spinbutton", { name: "Start time (ms)", exact: true }),
  ).toHaveValue("10000");
  await page
    .getByRole("button", {
      name: "Compact layout and time controls",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Dashboard", exact: true }).dblclick();
  const editor = page.getByRole("form", {
    name: "Dashboard tab settings",
    exact: true,
  });
  await editor
    .getByRole("checkbox", { name: "Lock dashboard", exact: true })
    .check();
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Layout settings", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Time window settings", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Expand layout and time controls",
      exact: true,
    }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 600, height: 850 });
  await expect(page.getByRole("tab", { selected: true })).toBeInViewport();
  await expect(controls).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("compact-tab-bar-narrow.png"),
  });
  expect(errors).toEqual([]);
});

test("shift+scroll pans the visible window without zooming", async ({
  page,
}) => {
  await addSignalToPane(page, "velocity");
  await expect(page.locator("canvas")).toHaveCount(1);
  await applyWindow(page, "10", "50");

  const start = page.getByRole("spinbutton", {
    name: "Start time (s)",
    exact: true,
  });
  const end = page.getByRole("spinbutton", {
    name: "End time (s)",
    exact: true,
  });
  await expect(start).toHaveValue("10");

  const chart = page
    .getByLabel("Interactive signal chart", { exact: true })
    .first();
  await chart.hover();
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 300);
  await page.keyboard.up("Shift");
  await flushFrames(page);

  // Panned forward, and the span is untouched: this is the whole point, since
  // ECharts on its own would have zoomed at the same time.
  await expect
    .poll(async () => Number(await start.inputValue()))
    .toBeGreaterThan(10);
  const span =
    Number(await end.inputValue()) - Number(await start.inputValue());
  expect(Math.abs(span - 40)).toBeLessThan(0.5);
});

test("charts can hold independent time windows", async ({ page }) => {
  await addSignalToPane(page, "velocity");
  await expect(page.locator("canvas")).toHaveCount(1);
  await applyWindow(page, "10", "50");

  // A second plot, so one can move while the other stays put.
  await page
    .getByRole("region", { name: "Chart panel 1", exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menu", { name: "Chart 1 actions" })
    .getByRole("menuitem", { name: "Split into columns", exact: true })
    .click();
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    2,
  );
  await addSignalToPane(page, "position", 2);
  await expect(page.locator("canvas")).toHaveCount(2);

  // Linked is the default, so no per-plot label is shown.
  await expect(paneWindow(page, 1)).toHaveCount(0);

  const link = page.getByRole("button", {
    name: "Link time window across charts",
    exact: true,
  });
  await expect(link).toHaveAttribute("aria-pressed", "true");
  await link.click();
  await expect(link).toHaveAttribute("aria-pressed", "false");
  // Unlinked, each plot states its own window — both still on the shared one.
  await expect(paneWindow(page, 1)).toContainText("10");
  await expect(paneWindow(page, 2)).toContainText("10");

  await page
    .getByLabel("Interactive signal chart", { exact: true })
    .first()
    .hover();
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 300);
  await page.keyboard.up("Shift");
  await flushFrames(page);

  // Only the panned plot moved, and the toolbar did not follow it.
  await expect.poll(() => paneWindow(page, 2).textContent()).toContain("10–50");
  expect(await paneWindow(page, 1).textContent()).not.toContain("10–50");
  await expect(
    page.getByRole("spinbutton", { name: "Start time (s)", exact: true }),
  ).toHaveValue("10");

  // A toolbar window is dashboard-wide: it pulls the stray plot back in line.
  await applyWindow(page, "20", "60");
  await expect.poll(() => paneWindow(page, 1).textContent()).toContain("20–60");
  await expect.poll(() => paneWindow(page, 2).textContent()).toContain("20–60");

  // Re-linking drops the per-plot labels again.
  await link.click();
  await expect(paneWindow(page, 1)).toHaveCount(0);
});

// An ADJ-backed session: enum handling is driven entirely by ADJ metadata
// (isDiscreteMeasurement), so the plain CSV fixture above can never produce a
// discrete signal. ADJ names are set equal to their ids to keep selectors
// identical to the other tests.
async function openEnumSession(page: Page) {
  const commit = "abc1234";
  await page.route(
    `https://hyperloop-upv.github.io/ADJ-Archive/storage/commit-${commit}.json`,
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          boards: {
            LCU: {
              LCU_measurements: [
                {
                  id: "velocity",
                  name: "velocity",
                  type: "float32",
                  displayUnits: "m/s",
                },
                {
                  id: "position",
                  name: "position",
                  type: "float32",
                  displayUnits: "mm",
                },
                {
                  id: "state",
                  name: "state",
                  type: "enum",
                  enumValues: ["IDLE", "READY", "RUNNING"],
                },
                {
                  id: "brake",
                  name: "brake",
                  type: "enum",
                  enumValues: ["OPEN", "CLOSED"],
                },
              ],
            },
          },
        }),
      }),
  );
  await page.evaluate(async (adjCommit) => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    const numeric = (offset: number) =>
      `0,LCU,backend,${offset}\n50000,LCU,backend,${offset + 2}\n100000,LCU,backend,${offset + 1}`;
    await useStore.getState().openSession([
      {
        name: "logger_settings.json",
        webkitRelativePath: "demo/logger_settings.json",
        text: async () =>
          JSON.stringify({
            adj_commit_hash: adjCommit,
            time_unit: "ms",
            date: "2026-01-01",
          }),
      },
      {
        name: "velocity.csv",
        webkitRelativePath: "demo/data/LCU/velocity.csv",
        text: async () => numeric(0),
      },
      {
        name: "position.csv",
        webkitRelativePath: "demo/data/LCU/position.csv",
        text: async () => numeric(1),
      },
      {
        name: "state.csv",
        webkitRelativePath: "demo/data/LCU/state.csv",
        text: async () =>
          "0,LCU,backend,IDLE\n40000,LCU,backend,READY\n80000,LCU,backend,RUNNING",
      },
      {
        name: "brake.csv",
        webkitRelativePath: "demo/data/LCU/brake.csv",
        text: async () => "0,LCU,backend,OPEN\n60000,LCU,backend,CLOSED",
      },
    ]);
  }, commit);
}

test("an enum drawn as a background band leaves the numeric axes alone", async ({
  page,
}) => {
  await openEnumSession(page);
  for (const name of ["velocity", "position", "state"])
    await addSignalToPane(page, name);
  await expect(page.locator("canvas")).toHaveCount(1);

  const pane = page.getByRole("region", { name: "Chart panel 1", exact: true });
  const band = page.getByRole("checkbox", {
    name: "Draw the enum as a background band",
    exact: true,
  });
  const openConfig = async () => {
    await page
      .getByRole("button", { name: "Configure chart 1", exact: true })
      .click();
  };

  // Two numeric units plus a banded enum: three signals, but only two axes, so
  // the panel must stay on original values.
  await expect(pane).not.toContainText("Relative %");
  await openConfig();
  await expect(band).toBeChecked();

  // Drawing it as a line gives it an axis of its own, which is the third
  // scale — that is what forces relative trends.
  await band.click();
  await page.keyboard.press("Escape");
  await expect(pane).toContainText("Relative %");

  // Back to a band, back to original values.
  await openConfig();
  await band.click();
  await page.keyboard.press("Escape");
  await expect(pane).not.toContainText("Relative %");
});

test("a plot of enums only renders as a state timeline", async ({ page }) => {
  await openEnumSession(page);
  await addSignalToPane(page, "state");
  // Several enums are allowed together: each becomes a timeline row.
  await addSignalToPane(page, "brake");
  await expect(page.locator("canvas")).toHaveCount(1);

  const pane = page.getByRole("region", { name: "Chart panel 1", exact: true });
  await expect(pane).toContainText("LCU / state");
  await expect(pane).toContainText("LCU / brake");
  // A state timeline has no numeric axes to normalize and no band to toggle.
  await expect(pane).not.toContainText("Relative %");
  await page
    .getByRole("button", { name: "Configure chart 1", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Draw the enum as a background band",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("a plot refuses a second enum alongside numeric signals", async ({
  page,
}) => {
  await openEnumSession(page);
  await addSignalToPane(page, "velocity");
  await addSignalToPane(page, "state");
  const pane = page.getByRole("region", { name: "Chart panel 1", exact: true });
  await expect(pane).toContainText("LCU / state");

  // One enum is in alongside a numeric signal, so the second one is refused
  // and said so, rather than silently producing an unreadable stack of bands.
  await addSignalToPane(page, "brake");
  await expect(page.getByRole("alert")).toContainText("one enum");
  await expect(pane).not.toContainText("LCU / brake");
  await expect(pane).toContainText("LCU / state");
});

test("a duplicate keeps its own per-plot windows", async ({ page }) => {
  await addSignalToPane(page, "velocity");
  await expect(page.locator("canvas")).toHaveCount(1);
  await applyWindow(page, "10", "50");
  await page
    .getByRole("button", {
      name: "Link time window across charts",
      exact: true,
    })
    .click();

  // Move the original off the dashboard window.
  await page
    .getByLabel("Interactive signal chart", { exact: true })
    .first()
    .hover();
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 300);
  await page.keyboard.up("Shift");
  await flushFrames(page);
  const moved = await paneWindow(page, 1).textContent();
  expect(moved).not.toContain("10–50");

  await page
    .getByRole("tab", { name: "Dashboard", exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menu", { name: "Dashboard tab actions" })
    .getByRole("menuitem", { name: "Duplicate", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Dashboard (copy)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  // The copy inherits the position...
  await expect.poll(() => paneWindow(page, 1).textContent()).toBe(moved);

  // ...but not the object: panning the copy must leave the original alone.
  await page
    .getByLabel("Interactive signal chart", { exact: true })
    .first()
    .hover();
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 300);
  await page.keyboard.up("Shift");
  await flushFrames(page);
  const copyMoved = await paneWindow(page, 1).textContent();
  expect(copyMoved).not.toBe(moved);

  await page.getByRole("tab", { name: "Dashboard", exact: true }).click();
  await expect.poll(() => paneWindow(page, 1).textContent()).toBe(moved);
});
