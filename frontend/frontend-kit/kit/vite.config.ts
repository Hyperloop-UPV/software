import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import react from "@vitejs/plugin-react-swc";
import { globSync } from "tinyglobby";
import { defineConfig, type Plugin } from "vite";
import dts from "vite-plugin-dts";

/**
 * Rollup strips module-level directives from the emitted JavaScript, so the
 * 18 shadcn files that opt into client rendering would lose it. They are inert
 * in Vite and Electron but required by a React Server Components consumer, so
 * put them back on the chunks whose source had one.
 */
const preserveUseClient = (): Plugin => ({
  name: "preserve-use-client",
  renderChunk(code, chunk) {
    const source = chunk.facadeModuleId;
    if (!source) return null;

    const directive = readFileSync(source, "utf8").trimStart();
    if (!directive.startsWith('"use client"') && !directive.startsWith("'use client'")) {
      return null;
    }

    return { code: `"use client";\n${code}`, map: null };
  },
});

// Every source file is its own Rollup entry. Together with preserveModules this
// mirrors src/ into dist/, which is what keeps the wildcard subpath exports
// ("./components/*") resolvable in the published package: a new component works
// with no entry list to maintain.
const entries = globSync(["src/**/*.{ts,tsx}"], {
  ignore: [
    // ./store re-exports ./use-dark-mode-store, which does not exist. Kept on
    // disk and in the dev exports, left out of the published surface.
    "src/store/**",
    "src/**/*.test.{ts,tsx}",
    "src/**/*.d.ts",
  ],
}).map((file) => resolve(file));

export default defineConfig({
  plugins: [
    react(),
    preserveUseClient(),
    dts({
      tsconfigPath: "./tsconfig.build.json",
      entryRoot: "src",
      outDir: "dist",
      // One .d.ts per module, mirroring dist/. Rolling them into a single file
      // would break per-subpath type resolution.
      rollupTypes: false,
      insertTypesEntry: false,
    }),
  ],
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    // Keeps the Tailwind class strings readable and the output debuggable. The
    // consuming app minifies anyway.
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: entries,
      // Vite defaults this to false for app builds, which Rollup rejects
      // together with preserveModules.
      preserveEntrySignatures: "strict",
      // Anything that is not a relative or absolute path is a bare specifier,
      // i.e. a dependency: leave it as an import instead of inlining it.
      external: (id) => !id.startsWith(".") && !isAbsolute(id),
      output: {
        format: "es",
        dir: "dist",
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
      },
      onwarn(warning, warn) {
        // preserveUseClient puts these back; Rollup's warning is expected.
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
    },
  },
});
