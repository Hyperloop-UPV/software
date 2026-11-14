import { expect, test } from "@playwright/test";
import {
  chartOption,
  gotoNormal,
  openBoard,
  openSession,
  pane,
  panes,
  patchSettings,
  pickPaneItem,
  plotSignals,
  readDownload,
  settings,
  sidebar,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await gotoNormal(page);
  await openSession(page);
  await plotSignals(page, ["velocity", "position"]);
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("statistics and cursor tables export as CSV and copy as a table", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await patchSettings(
    page,
    "return { ...current, showStatistics: true, showCursors: true, cursors: { a: 25000, b: 75000 } };",
  );
  const statistics = page.getByRole("region", {
    name: "Visible window statistics",
  });
  const csv = await readDownload(page, () =>
    statistics
      .getByRole("button", { name: "Download statistics as CSV" })
      .click(),
  );
  expect(csv.name).toMatch(/^window-statistics__.*\.csv$/);
  const lines = csv.bytes.toString().trim().split("\n");
  expect(lines[0]).toBe(
    "Board,Signal,Unit,Samples,Minimum,Maximum,Average,Standard deviation,First,Last,State changes",
  );
  // Raw numbers; state changes only apply to enums, so the cell is empty.
  expect(lines[1]).toMatch(/^LCU,velocity,,3,0,2,1,0\.8164965\d*,0,1,$/);

  await statistics
    .getByRole("button", { name: "Copy statistics as a table" })
    .click();
  await expect(
    statistics.getByRole("button", { name: "Copy statistics as a table" }),
  ).toContainText("Copied");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.split("\n")[1]).toMatch(
    /^LCU\tvelocity\t\t3\t0\t2\t1\t0\.8164965\d*\t0\t1\t$/,
  );

  const cursors = page.getByRole("region", { name: "Cursor measurements" });
  const cursorCsv = await readDownload(page, () =>
    cursors
      .getByRole("button", { name: "Download cursor measurements as CSV" })
      .click(),
  );
  expect(cursorCsv.bytes.toString()).toContain(
    "LCU,velocity,,25,75,1,1.5,0.5,0.01",
  );
});

test("a plot exports its image and the samples in its window", async ({
  page,
}) => {
  const png = await readDownload(page, () =>
    pickPaneItem(page, "Export", "Save as PNG"),
  );
  expect(png.name).toMatch(/^Plot__.*\.png$/);
  expect(png.bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );

  // Only the second half: the samples at 50 and 100 s of each signal.
  await patchSettings(
    page,
    "return { ...current, range: { start: 50, end: 100 } };",
  );
  const data = await readDownload(page, () =>
    pickPaneItem(page, "Export", "Visible data as CSV"),
  );
  expect(data.bytes.toString().trim().split("\n")).toEqual([
    "Board,Signal,Unit,Time (s),Value",
    "LCU,velocity,,50,2",
    "LCU,velocity,,100,1",
    "LCU,position,,50,3",
    "LCU,position,,100,2",
  ]);
});

test("double-clicking a measurement adds it to the plot last clicked", async ({
  page,
}) => {
  await page.keyboard.press("n");
  await expect(panes(page)).toHaveCount(2);
  // The plot clicked last is the target.
  await pane(page, 2).click();
  await openBoard(page);
  await sidebar(page).getByText("temperature", { exact: true }).dblclick();
  await expect(
    pane(page, 2).getByRole("button", { name: /LCU \/ temperature/ }),
  ).toBeVisible();

  await pane(page, 1).click();
  await sidebar(page).getByText("temperature", { exact: true }).dblclick();
  await expect(
    pane(page, 1).getByRole("button", { name: /LCU \/ temperature/ }),
  ).toBeVisible();
  // The two clicks of a double-click leave the selection untouched.
  await expect(page.locator("header")).toContainText("0 selected");
});

test("the search box adds measurements to the active plot or a new one", async ({
  page,
}) => {
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog", { name: "Add a measurement" });
  const search = dialog.getByRole("combobox", { name: "Search measurements" });
  await search.fill("temp");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await search.press("Enter");
  await expect(dialog.getByRole("status")).toHaveText(
    "Added LCU / temperature",
  );
  expect((await settings(page)).layoutState.ids).toContain("LCU/temperature");

  await search.fill("lcu");
  await expect(dialog.getByRole("option")).toHaveCount(3);
  await search.press("ArrowDown");
  await expect(dialog.getByRole("option").nth(1)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await search.press("Shift+Enter");
  // The modal hides the plots from the accessibility tree; ask the store.
  await expect
    .poll(async () => {
      const tree = (await settings(page)).layoutState.tree;
      return tree.type === "split" ? tree.second.signalIds : [];
    })
    .toEqual(["LCU/temperature"]);
  await search.fill("nothing like this");
  await expect(dialog).toContainText("No measurement matches");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("undo and redo bring back dashboard changes but not zoom", async ({
  page,
}) => {
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  await page.keyboard.press("n");
  await expect(panes(page)).toHaveCount(2);
  await page.waitForTimeout(500);
  await pickPaneItem(page, "Layout", "Close plot", 1);
  await expect(panes(page)).toHaveCount(1);

  // Zooming is view state: no undo step for it, and undo leaves it alone.
  await page.keyboard.press("+");
  await expect
    .poll(async () => (await settings(page)).range)
    .toEqual({ start: 25, end: 75 });

  await page.keyboard.press("Control+z");
  await expect(panes(page)).toHaveCount(2);
  await expect(
    pane(page, 1).getByRole("button", { name: /LCU \/ velocity/ }),
  ).toBeVisible();
  expect((await settings(page)).range).toEqual({ start: 25, end: 75 });
  await expect(redo).toBeEnabled();

  await page.keyboard.press("Control+Shift+z");
  await expect(panes(page)).toHaveCount(1);
  await undo.click();
  await expect(panes(page)).toHaveCount(2);
  await undo.click();
  await expect(panes(page)).toHaveCount(1);
  // One step left: adding the measurements, done when the test started.
  await undo.click();
  await expect(page.getByText("Empty plot", { exact: true })).toBeVisible();
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(page.locator("canvas")).toHaveCount(1);

  // In a text field, Ctrl+Z is the field's own undo.
  await page.keyboard.press("m");
  const name = page
    .getByRole("dialog", { name: "New formula" })
    .getByLabel("Name", { exact: true });
  await name.fill("Gap");
  await name.press("Control+z");
  await page.keyboard.press("Escape");
  await expect(panes(page)).toHaveCount(1);
});

test("a dashboard saved as a template starts a dashboard on another log", async ({
  page,
}) => {
  await page.keyboard.press("n");
  await expect(panes(page)).toHaveCount(2);
  await page
    .getByRole("tab", { name: "Dashboard", exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menu", { name: "Dashboard tab actions" })
    .getByRole("menuitem", { name: "Save as template…" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Save as template" });
  await dialog.getByLabel("Template name").fill("Speed check");
  await dialog.getByRole("button", { name: "Save template" }).click();
  await expect(dialog).toBeHidden();

  // Another log, where temperature was never recorded.
  await page.evaluate(async () => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    await useStore.getState().openSession(
      ["velocity", "position"].map((name) => ({
        name: `${name}.csv`,
        webkitRelativePath: `other/data/LCU/${name}.csv`,
        text: async () => "0,LCU,backend,5\n10000,LCU,backend,6",
      })),
    );
  });
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(panes(page)).toHaveCount(1);

  const templates = page.getByRole("button", {
    name: "New dashboard from a template",
  });
  await templates.click();
  await page.getByRole("menuitem", { name: /^Speed check/ }).click();
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(
    page.getByRole("tab", { name: "Speed check", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(panes(page)).toHaveCount(2);
  await expect(page.locator("canvas")).toHaveCount(1);

  await templates.click();
  await page
    .getByRole("button", { name: "Delete template Speed check" })
    .click();
  // Deleting neither applies the template nor closes the menu.
  await expect(page.getByRole("menu")).toContainText("Save as template");
  await expect(
    page.getByRole("menuitem", { name: /^Speed check/ }),
  ).toHaveCount(0);
  // The open menu hides the tabs from the accessibility tree; ask the store.
  expect(
    await page.evaluate(async () => {
      const modulePath = "/src/store/store.ts";
      const { useStore } = await import(/* @vite-ignore */ modulePath);
      return useStore.getState().normalDashboards.length;
    }),
  ).toBe(2);
});

test("a plot can draw its signals against another signal", async ({ page }) => {
  await pane(page).click({ button: "right" });
  await page
    .getByRole("menu", { name: "Chart 1 actions" })
    .getByRole("menuitem", { name: "View", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "X axis", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "LCU / velocity" }).click();

  await expect(pane(page).getByText("X: velocity")).toBeVisible();
  await expect(pane(page).getByLabel("X-Y chart")).toBeVisible();
  // position against velocity: the three shared instants, x spanning 0–2.
  const xy = await chartOption(page, "X-Y chart");
  expect(xy.xType).toBe("value");
  expect(xy.seriesLengths).toEqual([3]);
  expect(xy.xExtent[0]).toBeLessThanOrEqual(0);
  expect(xy.xExtent[1]).toBeGreaterThanOrEqual(2);
  const plotted = await settings(page);
  const first = plotted.layoutState.tree;
  expect(first.xSignalId).toBe("LCU/velocity");
  expect(first.signalIds).toEqual(["LCU/position"]);

  // Back to time: velocity is a plotted signal again.
  await pane(page).click({ button: "right" });
  await page
    .getByRole("menu", { name: "Chart 1 actions" })
    .getByRole("menuitem", { name: "View", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "X axis", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Time", exact: true }).click();
  await expect(pane(page).getByLabel("Interactive signal chart")).toBeVisible();
  expect((await settings(page)).layoutState.tree.signalIds).toEqual([
    "LCU/position",
    "LCU/velocity",
  ]);
});
