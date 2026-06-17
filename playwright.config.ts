import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"

// E2E runs against the dev server with the app's real Supabase project, using a
// dedicated test user created/reset in global-setup. Never against production.
dotenv.config({ path: ".env.local" })

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "tests",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    actionTimeout: 10_000,
  },

  projects: [
    { name: "setup", testMatch: /global\/auth\.setup\.ts/ },
    {
      name: "public",
      testMatch: "public/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authed",
      testMatch: "authed/**/*.spec.ts",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "tests/.auth/user.json" },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
