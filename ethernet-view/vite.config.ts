/// <reference types="vitest" />
import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./", // Add this line for relative paths
  build: {
    sourcemap: true,
    outDir: "static",
    minify: false,
  },
  plugins: [react(), tsconfigPaths(), svgr()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
  },
  resolve: {
    alias: {
      common: path.resolve(__dirname, "../common-front"),
    },
  },
});
