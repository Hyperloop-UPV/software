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

test("dashboards keep separate signals, layout, panel sizes and time settings", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await chooseSignal(page, "velocity");
  await chooseSignal(page, "position");
  await expect(page.locator("canvas")).toHaveCount(2);
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
  await expect(
    page.getByRole("heading", { name: "Choose signals to compare" }),
  ).toBeVisible();
  await expect(page.locator("header")).toContainText("0 selected");
  await chooseSignal(page, "temperature");
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
  await expect(
    page.getByRole("heading", { name: "Choose signals to compare" }),
  ).toBeVisible();
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
  await chooseSignal(page, "velocity");
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .click();
  await chooseSignal(page, "temperature");
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose signals to compare" }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("heading", { name: "velocity", exact: true }),
  ).toBeVisible();
  await expect(page.locator("header")).toContainText("1 selected");
  await openSession(page, "another-session");
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(page.locator("header")).toContainText(
    "another-session · 0 selected",
  );
  await expect(
    page.getByRole("heading", { name: "Choose signals to compare" }),
  ).toBeVisible();
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
  await chooseSignal(page, "velocity");
  await chooseSignal(page, "position");
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
  await chooseSignal(page, "velocity");
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

  await chooseSignal(page, "velocity");
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
  await chooseSignal(page, "velocity");
  await chooseSignal(page, "position");
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
  await chooseSignal(page, "temperature");
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
