import { test, expect } from "@playwright/test"
import path from "node:path"

const fixture = (name: string) => path.resolve("tests/fixtures", name)

// Runs as a logged-in, freshly-wiped test user (see global-setup). Serial so the
// onboarding step (no accounts) runs before import creates data.
test.describe.serial("Authenticated journey", () => {
  test("fresh account shows the onboarding welcome", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.getByRole("heading", { name: "Welcome to TradeOS" })).toBeVisible()
    await expect(page.getByText("Import your trades")).toBeVisible()
  })

  test("imports a NinjaTrader CSV and the trades appear", async ({ page }) => {
    await page.goto("/import")
    await page.locator('input[type="file"]').setInputFiles(fixture("ninjatrader.csv"))

    // Auto-detected → preview phase with the import CTA.
    const importBtn = page.getByRole("button", { name: /Import \d+ trades/ })
    await expect(importBtn).toBeVisible()
    await importBtn.click()

    // Done.
    await expect(page.getByText("Import another file")).toBeVisible({ timeout: 15_000 })

    // Trades now show up on the trades page.
    await page.goto("/trades")
    await expect(page.getByText("NQ").first()).toBeVisible()
  })

  test("an excluded break-even trade does not come back on re-import", async ({ page }) => {
    await page.goto("/import")
    await page.locator('input[type="file"]').setInputFiles(fixture("ninjatrader-be.csv"))

    // Fixture: one real trade (+$91.50) and one scratch (+$0.75) under the $2 default.
    const excludeBtn = page.getByRole("button", { name: "Exclude 1 trades" })
    await expect(excludeBtn).toBeVisible()
    await excludeBtn.click()

    const importBtn = page.getByRole("button", { name: /Import 1 trades/ })
    await expect(importBtn).toBeEnabled()
    await importBtn.click()
    await expect(page.getByText("Import another file")).toBeVisible({ timeout: 15_000 })

    // Same file again: the scratch comes back as SKIPPED and there is nothing to do.
    await page.goto("/import")
    await page.locator('input[type="file"]').setInputFiles(fixture("ninjatrader-be.csv"))

    await expect(page.getByText("SKIPPED")).toBeVisible()
    await expect(page.getByRole("button", { name: /Import \d+ trades/ })).toBeDisabled()
  })

  test("an unknown CSV opens the column mapper", async ({ page }) => {
    await page.goto("/import")
    await page.locator('input[type="file"]').setInputFiles(fixture("custom.csv"))
    await expect(page.getByRole("heading", { name: "Map your columns" })).toBeVisible()
  })

  test("trades outcome filter updates the URL", async ({ page }) => {
    await page.goto("/trades")
    await page.getByRole("button", { name: "Outcome" }).click()
    await page.getByRole("button", { name: "Winners" }).click()
    await expect(page).toHaveURL(/outcome=win/)
  })
})
