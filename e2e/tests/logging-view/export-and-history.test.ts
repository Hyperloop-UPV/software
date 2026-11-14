import { expect, test } from "@playwright/test";
import {
  gotoNormal,
  openSession,
  patchSettings,
  pickPaneItem,
  plotSignals,
  readDownload,
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
