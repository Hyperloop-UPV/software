#!/usr/bin/env node
/**
 * @file setup-python.mjs
 * @description Downloads portable Python builds and installs jsonschema for ADJ validation.
 * Uses python-build-standalone releases so the bundled interpreter is fully relocatable.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_ROOT = join(__dirname, "..", "python");

const RELEASE_TAG = "20260508";
const PYTHON_VERSION = "3.12";
const PYTHON_MINOR = "3.12.13";

const PLATFORMS = [
  {
    id: "windows-amd64",
    url: `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_TAG}/cpython-${PYTHON_MINOR}%2B${RELEASE_TAG}-x86_64-pc-windows-msvc-install_only_stripped.tar.gz`,
    pipPlatform: "win_amd64",
    pythonExe: "python.exe",
    sitePackages: `Lib/site-packages`,
  },
  {
    id: "linux-amd64",
    url: `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_TAG}/cpython-${PYTHON_MINOR}%2B${RELEASE_TAG}-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz`,
    pipPlatform: "manylinux2014_x86_64",
    pythonExe: "bin/python3",
    sitePackages: `lib/python${PYTHON_VERSION}/site-packages`,
  },
  {
    id: "darwin-amd64",
    url: `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_TAG}/cpython-${PYTHON_MINOR}%2B${RELEASE_TAG}-x86_64-apple-darwin-install_only_stripped.tar.gz`,
    pipPlatform: "macosx_10_12_x86_64",
    pythonExe: "bin/python3",
    sitePackages: `lib/python${PYTHON_VERSION}/site-packages`,
  },
  {
    id: "darwin-arm64",
    url: `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_TAG}/cpython-${PYTHON_MINOR}%2B${RELEASE_TAG}-aarch64-apple-darwin-install_only_stripped.tar.gz`,
    pipPlatform: "macosx_11_0_arm64",
    pythonExe: "bin/python3",
    sitePackages: `lib/python${PYTHON_VERSION}/site-packages`,
  },
];

function run(cmd, cwd, options = {}) {
  try {
    execSync(cmd, { cwd, stdio: "inherit", shell: true, ...options });
    return true;
  } catch (e) {
    if (options.ignoreError) {
      console.warn(`Warning: command failed: ${cmd}`);
      return false;
    }
    throw e;
  }
}

function download(url, dest) {
  if (existsSync(dest)) {
    console.log(`  ✓ Archive already downloaded`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  console.log(`  ⬇ Downloading portable Python...`);
  run(`curl -fsSL -o "${dest}" "${url}"`);
}

function extract(archive, dest) {
  if (existsSync(join(dest, "DONE.marker"))) {
    console.log(`  ✓ Already extracted`);
    return;
  }
  mkdirSync(dest, { recursive: true });
  console.log(`  📦 Extracting...`);
  run(`tar -xzf "${archive}" -C "${dest}" --strip-components=1`);
  // Create a marker file so we know extraction succeeded
  execSync(`touch "${join(dest, "DONE.marker")}"`);
}

function isAlreadyInstalled(pythonExe) {
  try {
    execSync(`"${pythonExe}" -c "import jsonschema"`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function installJsonschemaNative(pythonExe) {
  console.log(`  📦 Installing jsonschema (native pip)...`);
  run(`"${pythonExe}" -m pip install jsonschema==4.25.0`);
}

function installJsonschemaCross(platform, sitePackagesPath) {
  console.log(`  📦 Cross-installing jsonschema for ${platform.id}...`);
  const cmd = [
    `python3 -m pip install`,
    `--platform ${platform.pipPlatform}`,
    `--python-version ${PYTHON_VERSION}`,
    `--only-binary=:all:`,
    `--target "${sitePackagesPath}"`,
    `jsonschema==4.25.0`,
  ].join(" ");
  run(cmd);
}

// Detect host platform so we can use native pip when possible
const hostPlatform = `${process.platform}-${process.arch}`;
const hostIdMap = {
  "darwin-x64": "darwin-amd64",
  "darwin-arm64": "darwin-arm64",
  "linux-x64": "linux-amd64",
  "win32-x64": "windows-amd64",
};
const hostId = hostIdMap[hostPlatform];

console.log("\n🐍 Setting up bundled Python environments for ADJ validation\n");

mkdirSync(PYTHON_ROOT, { recursive: true });

for (const platform of PLATFORMS) {
  const dir = join(PYTHON_ROOT, `python-${platform.id}`);
  const archive = join(PYTHON_ROOT, `${platform.id}.tar.gz`);

  console.log(`\n▶ Platform: ${platform.id}`);

  download(platform.url, archive);
  extract(archive, dir);

  const pythonExe = join(dir, platform.pythonExe);
  const sitePackages = join(dir, platform.sitePackages);
  mkdirSync(sitePackages, { recursive: true });

  if (platform.id === hostId && existsSync(pythonExe)) {
    if (isAlreadyInstalled(pythonExe)) {
      console.log(`  ✓ jsonschema already installed`);
      continue;
    }
    try {
      installJsonschemaNative(pythonExe);
      continue;
    } catch (e) {
      console.warn(`  ⚠ Native install failed, falling back to cross-install`);
    }
  }

  // Check if cross-install already happened by looking for jsonschema dir
  if (existsSync(join(sitePackages, "jsonschema"))) {
    console.log(`  ✓ jsonschema already installed (cross)`);
    continue;
  }

  try {
    installJsonschemaCross(platform, sitePackages);
  } catch (e) {
    console.warn(`  ⚠ Cross-install failed for ${platform.id}`);
    console.warn(`     You may need to install jsonschema manually for this platform.`);
  }
}

console.log("\n✅ Python setup complete!\n");
