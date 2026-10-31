# `@hyperloop-upv/frontend-kit`

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
import { Button } from "@hyperloop-upv/frontend-kit/components";
import { useTopic } from "@hyperloop-upv/frontend-kit/hooks";
import { ChevronDown } from "@hyperloop-upv/frontend-kit/icons";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { socketService } from "@hyperloop-upv/frontend-kit/core";
import logo from "@hyperloop-upv/frontend-kit/outreach/main/logo_icon.svg";
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
pnpm --filter @hyperloop-upv/frontend-kit build
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

The kit is published to **GitHub Packages**, not npmjs.com. That registry
requires a token for every request, **including downloading a public package**,
so there is a one-time setup per contributor and per CI job.

`.npmrc` in the consuming repository:

```
@hyperloop-upv:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Each contributor exports `NODE_AUTH_TOKEN` with a **classic** personal access
token carrying the `read:packages` scope, from
<https://github.com/settings/tokens>. Use a classic token: fine-grained ones
still have patchy support for this registry. Without the variable, the install
fails with `ERR_PNPM_FETCH_401`.

In CI, use the job's own token and grant it read access to packages:

```yaml
permissions:
  contents: read
  packages: read # required even for a public package
steps:
  - run: pnpm install --frozen-lockfile
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Then install the package and the peer dependencies it expects you to own:

```bash
pnpm add @hyperloop-upv/frontend-kit
pnpm add react react-dom lucide-react tw-animate-css
pnpm add -D tailwindcss @tailwindcss/vite
```

> To try a change before it is published, build a tarball with
> `pnpm --filter @hyperloop-upv/frontend-kit exec pnpm pack` and
> `pnpm add` that file directly. No registry and no token involved.

`src/index.css`:

```css
@import "@hyperloop-upv/frontend-kit/globals.css";

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
import { configureSocket } from "@hyperloop-upv/frontend-kit/core";

configureSocket({ url: import.meta.env.VITE_WS_URL });
// or: configureSocket({ host: "pod.local", port: 8080, secure: true });
```

### Registering your own logger module

```ts
import { ansi, createLogger, registerLoggerColor } from "@hyperloop-upv/frontend-kit/core";

registerLoggerColor("pod-dashboard", ansi.cyan);
export const log = createLogger("pod-dashboard");
```

---

## Releasing

1. Bump `version` in this `package.json` and commit it.
2. Actions -> **Publish Frontend Kit** -> enter the version, leave **dry-run
   on**. Read the tarball listing in the log; the tarball is attached as an
   artifact if you want to install it somewhere first.
3. Run it again with **dry-run off**.
4. First release only: check the package is public under Organisation ->
   Packages -> Package settings, and that this repository has write access.

**A published version can never be reused.** Deleting a version does not free
the number. If `0.1.0` is wrong, publish `0.1.1`.

The five apps in this monorepo stay on `workspace:*` and are unaffected by what
is published: pnpm always prefers the local link. Only an external consumer
pins a published range such as `^0.1.0`, which on `0.x` picks up patches but
requires a deliberate edit to move to `0.2.0`.
