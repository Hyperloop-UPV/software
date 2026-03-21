import { defineConfig } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  workers: 1, // Electron tests must run serially — only one app instance at a time

  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  projects: [
    {
      name: "ui",
      testDir: "./tests/ui",
      use: {
        // UI tests run in mock mode — no backend needed
        // Requires testing-view to be built with: pnpm --filter testing-view build:e2e
      },
    },
    {
      name: "integration",
      testDir: "./tests/integration",
      use: {
        // Integration tests require the Go backend binary to be built
      },
    },
  ],
});
