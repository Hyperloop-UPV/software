# `@hyperloopupv/frontend-kit`

The shared frontend package for the Hyperloop Control Station: reusable styled
components and hooks built on **React**, **Shadcn/UI** and **Tailwind CSS**,
plus the framework-agnostic WebSocket and logging layer.

It is built for publication, so a frontend living in another repository can use
it too. See [Using it from another repository](#using-it-from-another-repository).

## Project Guidelines

### Where code goes

> - Logic that needs React hooks (`useState`, `useEffect`, ...) or TSX belongs
>   in `src/components`, `src/hooks` or `src/lib`.
> - **Logic that does NOT need React** (websocket connections, for example)
>   belongs in `src/core`, published as the `./core` subpath. That boundary is
>   enforced by a lint rule, not just convention: `src/core` may not import
>   React. It keeps `./core` usable from a plain Node script or an Electron main
>   process.

### Import paths

```ts
import { Button } from "@hyperloopupv/frontend-kit/components";
import { useTopic } from "@hyperloopupv/frontend-kit/hooks";
import { ChevronDown } from "@hyperloopupv/frontend-kit/icons";
import { cn } from "@hyperloopupv/frontend-kit/lib";
import { socketService } from "@hyperloopupv/frontend-kit/core";
import logo from "@hyperloopupv/frontend-kit/outreach/main/logo_icon.svg";
```

Inside this package, always use **relative** imports. Referring to the package
by its own name makes the published build depend on self-reference resolution,
which bundlers support unevenly.

---

## Icon Management

We use a custom Rust-based tool, **icons-master**, to manage our Lucide icon exports. This tool helps keep our icons organized by category and ensures we don't have duplicate exports.

### Usage

Here are the scripts you can run:

```bash
# Install dependencies
pnpm install

# Run linter
pnpm lint

# Add a new icon from Lucide (Example: pnpm icon:add arrow-up src/icons)
pnpm icon:add <icon-name> src/icons

# Remove an existing icon export (Example: pnpm icon:remove arrow-up src/icons)
pnpm icon:remove <icon-name> src/icons
```

---

## Build

```bash
pnpm --filter @hyperloopupv/frontend-kit build
```

Vite in library mode with Rollup's `preserveModules`, which mirrors `src/` into
`dist/`. That is what keeps the wildcard subpath exports (`./components/*`)
resolving as components are added, with no entry list to maintain. Rollup is
used rather than `tsc` or `tsup` because it rewrites relative specifiers with
real `.js` extensions; the other two emit extensionless imports, which are not
valid ESM.

`exports` points at `src/`, so the five apps in this monorepo keep compiling
kit source directly and keep their HMR. `publishConfig.exports` points at
`dist/` and is what an external consumer sees. **Publish with `pnpm publish`:**
`npm publish` ignores that override and would ship a package whose exports
point at `.tsx`, with no error at publish time.

The tarball ships `src/` as well as `dist/`. That is deliberate: the published
`globals.css` lives in `src/styles/` and its own `@source` directive resolves
relative to itself, so Tailwind finds the kit's classes inside `node_modules`
with no build-time transform.

---

## Using it from another repository

The kit is published to **npmjs.com** as a public package, so there is nothing
to set up: no `.npmrc`, no token, no registry configuration, on your machine or
in CI. That is why it goes there rather than to GitHub Packages, whose npm
registry demands a personal access token even to download a public package.

Note the scope is `@hyperloopupv`, **without the hyphen**. `@hyperloop-upv` on
npm belongs to an older account of the team's, used for the 2021 and 2023
frontends, whose credentials were lost.

Install it and the peer dependencies it expects you to own:

```bash
pnpm add @hyperloopupv/frontend-kit
pnpm add react react-dom lucide-react tw-animate-css
pnpm add -D tailwindcss @tailwindcss/vite
```

> To try a change before it is published, build a tarball with
> `pnpm --filter @hyperloopupv/frontend-kit exec pnpm pack` and `pnpm add`
> that file directly, or point at a local checkout with
> `pnpm add file:../software/frontend/frontend-kit/kit` while you iterate.

`src/index.css`:

```css
@import "@hyperloopupv/frontend-kit/globals.css";

/* Add your own sources. The kit's stylesheet can only register files inside
   the kit, because its directive resolves relative to node_modules. */
@source "./**/*.{ts,tsx}";
```

That single import brings the theme variables, the four themes, the dark and
pink variants, the `@theme inline` map, the base layer, scrollbars,
`tw-animate-css` and the Archivo font.

`vite.config.ts`:

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The kit declares react/react-dom as peers; dedupe guarantees one copy,
  // since two copies of React break hooks.
  resolve: { dedupe: ["react", "react-dom"] },
});
```

Do not add `@radix-ui/*` to your own dependencies. The kit owns those, and two
copies of the same Radix package cause real focus-trap and scroll-lock bugs.

Your `tsconfig` needs **no `paths` entry** for the kit, and must use
`"moduleResolution": "bundler"` (or `"nodenext"`) so TypeScript honours the
package's `exports` map.

### Pointing it at a backend

The socket defaults to `ws://127.0.0.1:4000/backend`. For anything else, set it
once when the app boots:

```ts
import { configureSocket } from "@hyperloopupv/frontend-kit/core";

configureSocket({ url: import.meta.env.VITE_WS_URL });
// or: configureSocket({ host: "pod.local", port: 8080, secure: true });
```

### Registering your own logger module

```ts
import { ansi, createLogger, registerLoggerColor } from "@hyperloopupv/frontend-kit/core";

registerLoggerColor("pod-dashboard", ansi.cyan);
export const log = createLogger("pod-dashboard");
```

---

## Releasing

### How to cut a release

1. Merge the change into `develop`. The workflow only appears in the Actions
   tab when it is on the default branch.
2. Actions -> **Publish Frontend Kit** -> *Run workflow*. Enter the version,
   **leave dry-run on**.
3. Read the run. It prints the whole tarball listing and attaches the `.tgz` as
   an artifact, and it has published nothing.
4. Run it again with **dry-run off**. That one publishes.

There is nothing to commit first and nothing to bump: the version comes from
the form. Pick it with ordinary semver, describing what changed in *the kit*.

### Why the kit versions on its own

Two separate workflows that do not touch each other: *Release Electron App*
ships the Control Station, *Publish Frontend Kit* publishes the package.

That is deliberate. The kit's number describes the kit's own API, so a frontend
in another repository can read it and judge an upgrade: `^0.2.0` means what it
says. Sharing the station's numbering would have made the number describe
release cadence instead, and a consumer could not tell a breaking change from a
release that never touched the kit.

### What the run actually does

In order, and everything before step 6 is reversible:

1. **Resolves the version and the dist-tag.** Strips a leading `v`. A version
   with a prerelease part goes to `next` rather than `latest`.
2. **Refuses to go backwards.** Fails if that version is already released, or
   if it sorts below the latest one. Compared with `sort -V`, so `0.10.0` ranks
   above `0.3.0`.
3. **Injects the version** with `pnpm version --no-git-tag-version`. The number
   in `package.json` is a placeholder and stays one; the git tag is the record
   of what shipped from which commit.
4. **Builds and packs** with pnpm. This is the step that applies
   `publishConfig`, rewriting `exports` from `src/*.tsx` to `dist/*.js`.
5. **Checks the tarball**: that `private` and the `preinstall` hook did not
   survive, that `publishConfig` was applied, that `./core` points at `dist`,
   that `globals.css` is served from `src`, that the five peers are declared,
   that no literal `workspace:` range leaked, and that `src/` ships.
6. **Publishes** the tarball from step 4 — the exact bytes step 5 checked.
7. **Tags** `frontend-kit-v<version>`, a GitHub release with the tarball
   attached and notes scoped to the previous kit release.

### The things that will bite you

**A published version can never be reused.** Deleting one does not free the
number. If `0.2.0` is wrong, publish `0.2.1`. This is why dry-run is the
default and why step 5 exists.

**Never `npm publish` from the package directory.** `publishConfig.exports` is
a pnpm feature; npm ignores it and would ship a package whose `exports` point
at `.tsx`, **with no error at publish time**. It breaks in the consumer, later.
The workflow runs `npm publish` on a *tarball*, which is safe precisely because
`pnpm pack` already rewrote the manifest inside it. If you ever publish by
hand, `pnpm pack` first and publish the `.tgz`.

**Do not rename `publish-frontend-kit.yaml`.** npm's trusted publishing config
names this repository and that exact filename. Renaming it breaks publishing
with an error that does not say why.

**Do not bump `packageManager` to pnpm 11 without testing a release.** pnpm 11
broke OIDC publishing with a 404 where pnpm 10 works.

### Authentication

There is no npm token anywhere, and no secret to rotate. The job mints an OIDC
token, npm exchanges it for a short-lived credential, and the upload carries a
provenance attestation for free. This needs `id-token: write` on the job, npm
CLI 11.5.1+ and Node 22.14+; the run installs a current npm rather than
trusting the runner image.

`publishConfig` carries `access: public`, without which npm would try to
publish a scoped package privately and fail.

Trusted publishing cannot bootstrap a package that does not exist, so `0.1.0`
was published by hand to create it. Everything after that goes through CI.

### The dist-tag

A version with a prerelease part (`0.3.0-beta.1`) is published under the `next`
dist-tag instead of `latest`, so `pnpm add @hyperloopupv/frontend-kit` keeps
resolving to the last stable release. Taking a prerelease is then explicit:

```bash
pnpm add @hyperloopupv/frontend-kit@next
```

### What a consumer should pin

Ordinary semver applies, so a caret range is safe on a stable line:

```json
"@hyperloopupv/frontend-kit": "^0.2.0"
```

On `0.x` that anchors the minor: it picks up `0.2.x` patches but needs a
deliberate edit to move to `0.3.0`, which is the right default while the API is
still settling.

The five apps in this monorepo stay on `workspace:*` and are unaffected by what
is published: pnpm always prefers the local link.
