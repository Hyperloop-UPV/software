import { expect, test } from "../../fixtures/electron";

// Every case writes the same key. Without per-test profiles the second case fails.
for (const run of [1, 2]) {
  test(`Electron uses an isolated profile for integration case ${run}`, async ({
    app,
    page,
  }) => {
    const profile = await app.evaluate(({ app }) => ({
      actual: app.getPath("userData"),
      expected: process.env.CONTROL_STATION_E2E_PROFILE,
    }));
    expect(profile.actual).toBe(profile.expected);
    expect(
      await page.evaluate(() => localStorage.getItem("e2e-profile-sentinel")),
    ).toBeNull();
    await page.evaluate(() =>
      localStorage.setItem("e2e-profile-sentinel", "persisted-in-this-test"),
    );
    await page.reload();
    expect(
      await page.evaluate(() => localStorage.getItem("e2e-profile-sentinel")),
    ).toBe("persisted-in-this-test");
  });
}
