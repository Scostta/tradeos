import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

const srcDir = fileURLToPath(new URL("./src", import.meta.url))

export default defineConfig({
  test: {
    environment: "node",
    // Stored timestamps are UTC ISO strings; pin the runtime TZ so
    // day-of-week / equity-curve assertions are deterministic.
    env: { TZ: "UTC" },
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: [{ find: /^~\//, replacement: `${srcDir}/` }],
  },
})
