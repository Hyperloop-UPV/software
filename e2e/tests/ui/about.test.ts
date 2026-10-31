import type { ElectronApplication } from "@playwright/test";
import { expect, test } from "../../fixtures/electron";

async function openAbout(app: ElectronApplication) {
  const opened = app.waitForEvent("window");
  await app.evaluate(({ BrowserWindow, Menu }) => {
    const item = Menu.getApplicationMenu()!.items.find(
      (item) => item.label === "Help",
    )!.submenu!.items[0];
    const parent = BrowserWindow.getAllWindows().find((window) =>
      window.webContents.getURL().includes("/testing-view/"),
    )!;
    item.click(item, parent, {} as never);
  });
  const about = await opened;
  await expect(about.locator("#contributors li").first()).toBeVisible();
  return about;
}

test("About shows both original logos and descending credits entirely offline", async ({
  app,
}) => {
  const remoteRequests: string[] = [];
  await app.context().route(/^https?:/, (route) => {
    // Other open views still use their backend; only About must be network-free.
    if (route.request().frame().url().includes("/about/")) {
      remoteRequests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await app.evaluate(() => {
    const state = globalThis as typeof globalThis & { aboutFetchCalls: number };
    state.aboutFetchCalls = 0;
    globalThis.fetch = async () => {
      state.aboutFetchCalls++;
      throw new Error("No runtime network allowed");
    };
  });
  const about = await openAbout(app);
  await expect(about.getByRole("heading", { level: 1 })).toHaveText(
    "Control Station",
  );
  await expect(about.locator("#app-version")).toContainText("Version");
  await expect(
    about.locator("#refresh, #sort, #search, #commit-list, .hero"),
  ).toHaveCount(0);
  const assets = await about
    .locator("header img, .avatar img")
    .evaluateAll((images) =>
      images.map((element) => {
        const image = element as HTMLImageElement;
        return {
          source: image.src,
          loaded: image.complete && image.naturalWidth > 0,
        };
      }),
    );
  expect(assets.length).toBeGreaterThan(2);
  expect(
    assets.every((asset) => asset.source.startsWith("file:") && asset.loaded),
  ).toBe(true);
  const counts = await about.locator(".count").allTextContents();
  const numbers = counts.map((value) => Number(value.replace(/[^0-9]/g, "")));
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
  expect(remoteRequests).toEqual([]);
  expect(
    await app.evaluate(
      () =>
        (globalThis as typeof globalThis & { aboutFetchCalls: number })
          .aboutFetchCalls,
    ),
  ).toBe(0);
  await about.screenshot({
    path: test.info().outputPath("about.png"),
    fullPage: true,
  });
  await about.reload();
  await expect(about.locator("#contributors li")).toHaveCount(numbers.length);
  expect(
    await app.evaluate(
      () =>
        (globalThis as typeof globalThis & { aboutFetchCalls: number })
          .aboutFetchCalls,
    ),
  ).toBe(0);
});

test("About opens a member's GitHub profile and stays compact", async ({
  app,
}) => {
  const about = await openAbout(app);
  await app.evaluate(({ shell }) => {
    const state = globalThis as typeof globalThis & { aboutLinks: string[] };
    state.aboutLinks = [];
    shell.openExternal = async (url) => {
      state.aboutLinks.push(url);
    };
  });
  const member = about.locator("button.contributor").first();
  const name = await member.locator(".name").innerText();
  await member.focus();
  await member.press("Enter");
  expect(
    await app.evaluate(
      () =>
        (globalThis as typeof globalThis & { aboutLinks: string[] }).aboutLinks,
    ),
  ).toEqual([`https://github.com/${name}`]);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((window) => window.getTitle() === "About Control Station")!
      .setSize(440, 620);
  });
  expect(
    await about.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await about.keyboard.press("Escape").catch((error) => {
    if (!about.isClosed()) throw error;
  });
  await expect.poll(() => about.isClosed()).toBe(true);
});
