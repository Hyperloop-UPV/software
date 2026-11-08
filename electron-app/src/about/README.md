# About

A small About window with the original Hyperloop UPV and Software logos, Control Station, its version, and contributors sorted by descending commit count. Clicking a linked contributor opens their GitHub profile in the default browser. Unlinked authors remain credited without an invented profile; bots are excluded from the member list.

## Build-time generation

`generateCredits.js` fetches every page of the public GitHub commits API for the default branch. Commits with two or more parents (including octopus merges) are excluded. Root commits and empty non-merge commits count. Authors are grouped by GitHub account ID, or by author email for unlinked accounts; email addresses are only temporary grouping keys and are never stored. A SHA set prevents duplicate counts, and pagination is pinned to the first page's head SHA so new pushes cannot shift the history mid-build.

The `contributions` field is the resulting non-merge count, not GitHub's merge-inclusive contributors total. Avatars are downloaded into `renderer/about/avatars/`. Rebuilding an unchanged head reuses the existing counts and photos. The full initial traversal may require a GitHub token to stay within API limits.

It runs from `build.mjs` for frontend/Electron builds and from electron-builder's `beforePack` hook, covering `pack`, all `dist` commands and `.github/workflows/release.yaml`. CI's existing `GH_TOKEN` is used if available. For a manual refresh: `pnpm --dir electron-app build:credits`.

The generated `credits.snapshot.json` records `counting: "non-merge"` and the head SHA. It and the images ship in the existing `src/**/*` / `renderer/**/*` packaging globs. Offline builds keep the previous non-merge snapshot; missing photos fall back to saved photos or initials. Failed pagination never replaces the complete snapshot with a partial list, and legacy merge-inclusive snapshots are not accepted as a fallback.

## Runtime

Opening About only reads the bundled JSON and images. There is no GitHub fetch, background refresh, user cache, search, activity feed or synchronization control. The renderer's CSP blocks all network access. Its sandboxed preload exposes only credits and a sender-checked, contributor-ID-based profile opener. Go is untouched.

Tests: `pnpm --dir electron-app test` and `pnpm --dir e2e test:fast:ui --grep 'About shows|About opens|English menus'`.
