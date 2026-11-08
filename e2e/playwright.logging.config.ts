import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/logging-view",
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:9007",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "pnpm --dir ../frontend/logging-view dev --host 127.0.0.1 --port 9007 --strictPort",
    url: "http://127.0.0.1:9007",
    reuseExistingServer: !process.env.CI,
  },
});
