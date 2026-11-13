import { expect, test, type Page } from "@playwright/test";

// velocity = 0, 2, 1 · position = 1, 3, 2, sampled at the same three instants.
async function openSession(page: Page) {
  await page.evaluate(async () => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    await useStore.getState().openSession(
      ["velocity", "position"].map((name, index) => ({
        name: `${name}.csv`,
        webkitRelativePath: `demo/data/LCU/${name}.csv`,
        text: async () =>
          `0,LCU,backend,${index}\n50000,LCU,backend,${index + 2}\n100000,LCU,backend,${index + 1}`,
      })),
    );
  });
}

const pane = (page: Page, number = 1) =>
  page.getByRole("region", { name: `Chart panel ${number}`, exact: true });

const paneMenu = (page: Page, number = 1) =>
  page.getByRole("menu", { name: `Chart ${number} actions` });

const chart = (page: Page) =>
  page.getByLabel("Interactive signal chart").first();

async function plotSignals(page: Page, names: string[]) {
  const sidebar = page.locator('[data-slot="sidebar-content"]');
  const board = sidebar.getByRole("button", { name: /^LCU/ });
  if ((await board.getAttribute("data-state")) !== "open") await board.click();
  for (const name of names)
    await sidebar.getByText(name, { exact: true }).click();
  await pane(page).click({ button: "right" });
  await paneMenu(page)
    .getByRole("menuitem", { name: /^Add \d+ selected measurements?$/ })
    .click();
  await expect(page.locator("canvas")).toHaveCount(1);
}

// The active dashboard's settings, straight from the store.
async function settings(page: Page) {
  return page.evaluate(async () => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    const state = useStore.getState();
    return state.normalDashboards.find(
      (dashboard: { id: string }) =>
        dashboard.id === state.activeNormalDashboardId,
    ).settings;
  });
}

// Extent of the first y axis as ECharts drew it.
async function yExtent(page: Page): Promise<[number, number]> {
  return page.evaluate(async () => {
    // The exact URL the app loaded, hash included: any other one would be a
    // second copy of ECharts that knows nothing about the app's charts.
    const modulePath = performance
      .getEntriesByType("resource")
      .find((entry) => /\/deps\/echarts\.js/.test(entry.name))!.name;
    const echarts = await import(/* @vite-ignore */ modulePath);
    const element = document.querySelector(
      '[aria-label="Interactive signal chart"]',
    );
    const instance = echarts.getInstanceByDom(element);
    return instance.getModel().getComponent("yAxis", 0).axis.scale.getExtent();
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/#/normal");
  await expect(
    page.getByRole("heading", { name: "Open a logging session" }),
  ).toBeVisible();
  await openSession(page);
});

test("right-clicking a plot at the bottom of the window only opens its menu", async ({
  page,
}) => {
  await plotSignals(page, ["velocity"]);
  const box = (await pane(page).boundingBox())!;
  // Low enough that the menu has no room below and opens over the pointer.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 6, {
    button: "right",
  });
  await expect(paneMenu(page)).toBeVisible();
  // Nothing was picked by the release of that same click.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(pane(page).getByRole("textbox")).toHaveCount(0);
  await expect(
    paneMenu(page).getByRole("menuitem", { name: "Layout", exact: true }),
  ).toBeVisible();
  await expect(
    paneMenu(page).getByRole("menuitem", { name: "View", exact: true }),
  ).toBeVisible();
});

test("ctrl+drag zooms to the selected stretch of time", async ({ page }) => {
  await plotSignals(page, ["velocity"]);
  expect((await settings(page)).range).toEqual({ start: 0, end: 100 });
  const box = (await chart(page).boundingBox())!;
  const y = box.y + box.height / 2;
  await page.keyboard.down("Control");
  await page.mouse.move(box.x + box.width * 0.4, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.7, y, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Control");
  await expect
    .poll(async () => (await settings(page)).range.end)
    .toBeLessThan(90);
  const { start, end } = (await settings(page)).range;
  expect(start).toBeGreaterThan(10);
  expect(end - start).toBeGreaterThan(15);
  expect(end - start).toBeLessThan(60);
});

test("fit Y scales the axis to the visible window", async ({ page }) => {
  await plotSignals(page, ["velocity"]);
  // Second half of the recording: velocity only moves between 2 and 1.
  await page.evaluate(async () => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    const state = useStore.getState();
    state.updateNormalDashboardSettings(
      state.activeNormalDashboardId,
      (current: object) => ({ ...current, range: { start: 50, end: 100 } }),
    );
  });
  await expect.poll(async () => (await settings(page)).range.start).toBe(50);
  expect((await yExtent(page))[0]).toBeLessThanOrEqual(0);

  await pane(page).click({ button: "right" });
  await paneMenu(page)
    .getByRole("menuitem", { name: "View", exact: true })
    .click();
  await page
    .getByRole("menuitemcheckbox", { name: "Fit Y to window", exact: true })
    .click();
  await expect.poll(async () => (await yExtent(page))[0]).toBeGreaterThan(0.5);
  const [min, max] = await yExtent(page);
  expect(min).toBeLessThan(1);
  expect(max).toBeGreaterThan(2);
  expect(max).toBeLessThan(2.5);
});

const readout = (page: Page) =>
  page.getByRole("region", { name: "Cursor measurements" });

test("cursors measure the time and value between two clicks", async ({
  page,
}) => {
  await plotSignals(page, ["velocity"]);
  await page.getByRole("button", { name: "Plot overlays" }).click();
  await page
    .getByRole("menuitemcheckbox", { name: "Cursors", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(readout(page)).toContainText("Click a plot to place A");

  const box = (await chart(page).boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.click(box.x + box.width * 0.3, y);
  await expect
    .poll(async () => (await settings(page)).cursors.a)
    .not.toBeNull();
  await page.keyboard.down("Shift");
  await page.mouse.click(box.x + box.width * 0.7, y);
  await page.keyboard.up("Shift");
  await expect
    .poll(async () => (await settings(page)).cursors.b)
    .not.toBeNull();

  // Dragging pans (nothing to pan at full zoom) but must not move a cursor.
  const placed = (await settings(page)).cursors;
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, y, { steps: 4 });
  await page.mouse.up();
  expect((await settings(page)).cursors).toEqual(placed);

  // Pin both to known instants: velocity is 0 → 2 → 1 over 0, 50 and 100 s.
  await page.evaluate(async () => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    const state = useStore.getState();
    state.updateNormalDashboardSettings(
      state.activeNormalDashboardId,
      (current: object) => ({ ...current, cursors: { a: 25_000, b: 75_000 } }),
    );
  });
  await expect(readout(page).getByLabel("Cursor A")).toHaveText("25 s");
  await expect(readout(page).getByLabel("Cursor B")).toHaveText("75 s");
  await expect(readout(page).getByLabel("Cursor Δt")).toHaveText("50 s");
  await expect(readout(page).getByLabel("Cursor 1/Δt")).toHaveText("0.02 Hz");
  const row = readout(page).getByRole("row").filter({ hasText: "velocity" });
  // At A = 1, at B = 1.5, Δ = 0.5, slope = 0.01 per second.
  await expect(row.getByRole("cell")).toHaveText([
    /.*/,
    "1",
    "1.5",
    "0.5",
    "0.01",
  ]);

  await readout(page).getByRole("button", { name: "Clear cursors" }).click();
  expect((await settings(page)).cursors).toEqual({ a: null, b: null });
});

test("keyboard shortcuts drive the dashboard and stay out of text fields", async ({
  page,
}) => {
  await plotSignals(page, ["velocity"]);
  const box = (await chart(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await page.keyboard.press("+");
  await expect
    .poll(async () => (await settings(page)).range)
    .toEqual({ start: 25, end: 75 });
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await settings(page)).range)
    .toEqual({ start: 35, end: 85 });
  await page.keyboard.press("-");
  await page.keyboard.press("0");
  await expect
    .poll(async () => (await settings(page)).range)
    .toEqual({ start: 0, end: 100 });

  await page.keyboard.press("s");
  await expect(
    page.getByRole("region", { name: "Visible window statistics" }),
  ).toBeVisible();
  await page.keyboard.press("c");
  await expect(readout(page)).toBeVisible();
  await page.keyboard.press("l");
  expect((await settings(page)).linkTimeAxis).toBe(false);
  await page.keyboard.press("l");
  expect((await settings(page)).linkTimeAxis).toBe(true);

  await page.keyboard.press("n");
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    2,
  );
  // The pointer is still over the first plot, so F and Y act on it.
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.keyboard.press("f");
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    1,
  );
  await page.keyboard.press("y");
  await expect
    .poll(async () => {
      const { layoutState, focusedId } = await settings(page);
      const find = (node: any): any =>
        node.type === "pane"
          ? node.id === focusedId
            ? node
            : null
          : (find(node.first) ?? find(node.second));
      return find(layoutState.tree)?.fitY;
    })
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    2,
  );

  // Typing in a field is just typing.
  await page.keyboard.press("m");
  const dialog = page.getByRole("dialog", { name: "New formula" });
  await dialog.getByLabel("Name", { exact: true }).fill("scn0-+");
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(
    "scn0-+",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: /^Chart panel / })).toHaveCount(
    2,
  );
  expect((await settings(page)).showStatistics).toBe(true);

  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(help).toContainText("Zoom in");
  await expect(help).toContainText("Measuring cursors");
});
