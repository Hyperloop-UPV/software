import { expect, type Page } from "@playwright/test";

// velocity = 0, 2, 1 · position = 1, 3, 2 · temperature = 2, 4, 3, sampled at
// 0, 50 and 100 s.
export const SIGNALS = ["velocity", "position", "temperature"];

export async function openSession(page: Page, folder = "demo") {
  await page.evaluate(
    async ({ names, folder }) => {
      const modulePath = "/src/store/store.ts";
      const { useStore } = await import(/* @vite-ignore */ modulePath);
      await useStore.getState().openSession(
        names.map((name, index) => ({
          name: `${name}.csv`,
          webkitRelativePath: `${folder}/data/LCU/${name}.csv`,
          text: async () =>
            `0,LCU,backend,${index}\n50000,LCU,backend,${index + 2}\n100000,LCU,backend,${index + 1}`,
        })),
      );
    },
    { names: SIGNALS, folder },
  );
}

export async function gotoNormal(page: Page) {
  await page.goto("/#/normal");
  await expect(
    page.getByRole("heading", { name: "Open a logging session" }),
  ).toBeVisible();
}

export const pane = (page: Page, number = 1) =>
  page.getByRole("region", { name: `Chart panel ${number}`, exact: true });

export const panes = (page: Page) =>
  page.getByRole("region", { name: /^Chart panel / });

export const paneMenu = (page: Page, number = 1) =>
  page.getByRole("menu", { name: `Chart ${number} actions` });

export const sidebar = (page: Page) =>
  page.locator('[data-slot="sidebar-content"]');

export async function openBoard(page: Page) {
  const board = sidebar(page).getByRole("button", { name: /^LCU/ });
  if ((await board.getAttribute("data-state")) !== "open") await board.click();
}

export async function plotSignals(page: Page, names: string[], number = 1) {
  await openBoard(page);
  for (const name of names)
    await sidebar(page).getByText(name, { exact: true }).click();
  await pane(page, number).click({ button: "right" });
  await paneMenu(page, number)
    .getByRole("menuitem", { name: /^Add \d+ selected measurements?$/ })
    .click();
  // Leave nothing selected, so the next call starts clean.
  for (const name of names)
    await sidebar(page).getByText(name, { exact: true }).click();
}

export async function pickPaneItem(
  page: Page,
  submenu: string,
  item: string,
  number = 1,
) {
  await pane(page, number).click({ button: "right" });
  await paneMenu(page, number)
    .getByRole("menuitem", { name: submenu, exact: true })
    .click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

/** The active dashboard's settings, straight from the store. */
export async function settings(page: Page) {
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

/** Runs `body` as `(current) => next` over the active dashboard's settings. */
export async function patchSettings(page: Page, body: string) {
  await page.evaluate(async (source) => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    const state = useStore.getState();
    const change = new Function("current", source) as (
      current: object,
    ) => object;
    state.updateNormalDashboardSettings(state.activeNormalDashboardId, change);
  }, body);
}

/** The app's own ECharts instance for the first chart matching `label`. */
export async function chartOption(
  page: Page,
  label = "Interactive signal chart",
) {
  return page.evaluate(async (ariaLabel) => {
    const modulePath = performance
      .getEntriesByType("resource")
      .find((entry) => /\/deps\/echarts\.js/.test(entry.name))!.name;
    const echarts = await import(/* @vite-ignore */ modulePath);
    const element = document.querySelector(`[aria-label="${ariaLabel}"]`);
    const instance = echarts.getInstanceByDom(element);
    const xAxis = instance.getModel().getComponent("xAxis", 0).axis;
    return {
      xType: xAxis.type as string,
      xExtent: xAxis.scale.getExtent() as [number, number],
      seriesLengths: (instance.getOption().series as { data: unknown[] }[]).map(
        (series) => series.data.length,
      ),
    };
  }, label);
}

export async function readDownload(
  page: Page,
  trigger: () => Promise<void>,
): Promise<{ name: string; bytes: Buffer }> {
  const download = page.waitForEvent("download");
  await trigger();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return { name: file.suggestedFilename(), bytes: Buffer.concat(chunks) };
}
