// NOTE: ./use-dark-mode-store does not exist, so this barrel is broken and
// nothing imports it. It is left in place, and in the dev exports, but excluded
// from the build (vite.config.ts), from tsconfig.build.json and from
// publishConfig.exports. If you add use-dark-mode-store.ts, re-add "./store" in
// those three places for it to work from the published package.
export * from "./use-dark-mode-store";
