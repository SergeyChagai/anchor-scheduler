import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * The core package is consumed straight from source: one type-check, one
 * build, and edits to the engine hot-reload in the UI without a dist step.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@anchor-scheduler/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
    },
  },
  server: { port: 5173 },
});
