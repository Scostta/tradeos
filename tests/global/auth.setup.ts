import { test as setup, expect } from "@playwright/test"
import { TEST_EMAIL, TEST_PASSWORD, AUTH_FILE } from "./test-user"

// Logs in the dedicated test user through the real login form and saves the
// authenticated storage state for the "authed" project to reuse.
setup("authenticate", async ({ page }) => {
  await page.goto("/login")
  await page.locator('input[name="email"]').fill(TEST_EMAIL)
  await page.locator('input[name="password"]').fill(TEST_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()

  await page.waitForURL("**/dashboard", { timeout: 15_000 })
  await expect(page).toHaveURL(/\/dashboard/)

  await page.context().storageState({ path: AUTH_FILE })
})
