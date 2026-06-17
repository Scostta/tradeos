import { test, expect } from "@playwright/test"

// The public share route must be reachable WITHOUT auth, and show a friendly
// not-found for unknown/revoked tokens.
test.describe("Public share", () => {
  test("unknown token shows the not-found page (no login redirect)", async ({ page }) => {
    await page.goto("/share/this-token-does-not-exist")
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText("Report not available")).toBeVisible()
  })
})
