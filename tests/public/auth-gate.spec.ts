import { test, expect } from "@playwright/test"

// Logged-out behavior of the auth gate (middleware) and the login/register pages.
test.describe("Auth gate", () => {
  test("protected route redirects to login when logged out", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("reports route also redirects when logged out", async ({ page }) => {
    await page.goto("/reports")
    await expect(page).toHaveURL(/\/login/)
  })

  test("login page renders", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
  })

  test("invalid credentials show an error and stay on login", async ({ page }) => {
    await page.goto("/login")
    await page.locator('input[name="email"]').fill("nobody@tradeos.test")
    await page.locator('input[name="password"]').fill("wrong-password")
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test("can navigate from login to register", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("link", { name: "Create one" }).click()
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible()
  })
})
