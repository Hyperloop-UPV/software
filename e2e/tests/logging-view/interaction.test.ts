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
