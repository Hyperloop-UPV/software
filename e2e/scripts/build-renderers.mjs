import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedAboutCredits } from "./about-credits.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("Run this build through pnpm --dir e2e build");

for (const view of ["testing", "competition", "logging", "adj"]) {
  // Preserve Testing's E2E build; do not rebuild it in normal mode afterwards.
  execFileSync(
    process.execPath,
    [
      pnpmCli,
      "--filter",
      `${view}-view`,
      view === "testing" ? "build:e2e" : "build",
    ],
    { cwd: root, stdio: "inherit" },
  );
  const source = path.join(root, "frontend", `${view}-view`, "dist");
  if (!existsSync(path.join(source, "index.html")))
    throw new Error(`Missing build for ${view}`);
  const destination = path.join(
    root,
    "electron-app",
    "renderer",
    `${view}-view`,
  );
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true });
}

// About reads a build-time snapshot that a fresh clone does not have.
const credits = await seedAboutCredits();
console.log(
  credits === "fixture"
    ? "About credits: wrote the offline e2e fixture."
    : "About credits: keeping the generated snapshot already on disk.",
);
