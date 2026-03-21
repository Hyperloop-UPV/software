import { dirname } from "path";
import path from "path";
import { fileURLToPath } from "url";

// electron-app root is 3 levels up from this file:
// electron-app/src/utils/__tests__/helpers.js -> ../../../ = electron-app/
export const ELECTRON_APP_ROOT = path.resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

export function mockPlatform(platform) {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
}

export function mockArch(arch) {
  Object.defineProperty(process, "arch", {
    value: arch,
    configurable: true,
  });
}
