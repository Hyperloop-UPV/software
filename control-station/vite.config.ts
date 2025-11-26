import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./", // Add this line for relative paths
  plugins: [react(), tsconfigPaths(), svgr()],
  build: {
    outDir: "./static",
    minify: false,
  },
  resolve: {
    alias: {
      common: path.resolve(__dirname, "../common-front"),
    },
  },
});
