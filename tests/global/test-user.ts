// Dedicated E2E test user. Created/reset in global-setup via the Supabase admin
// API and wiped fresh on every run, so authenticated tests are deterministic.
// Not a real person — never used outside the test suite.
export const TEST_EMAIL    = "e2e@tradeos.test"
export const TEST_PASSWORD = "E2e-Test-Pass-123!"

export const AUTH_FILE = "tests/.auth/user.json"
