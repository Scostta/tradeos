import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { TEST_EMAIL, TEST_PASSWORD } from "./global/test-user"

dotenv.config({ path: ".env.local" })

// Tables to clear for the test user so each run starts fresh. `accounts` first
// (cascades trades + attachments + account-scoped rows); the rest by user_id.
const USER_TABLES = [
  "accounts",
  "trade_attachments",
  "report_shares",
  "ai_insights",
  "user_goals",
  "daily_journal",
  "trades",
  "playbooks",
  "profiles",
] as const

export default async function globalSetup(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("E2E setup: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (check .env.local)")
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })

  // Ensure the test user exists with a known, confirmed password.
  const created = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })

  let userId = created.data.user?.id
  if (created.error || !userId) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const existing = list?.users.find((u) => u.email === TEST_EMAIL)
    if (!existing) throw created.error ?? new Error("E2E setup: could not create or find the test user")
    userId = existing.id
    await admin.auth.admin.updateUserById(userId, { password: TEST_PASSWORD, email_confirm: true })
  }

  // Wipe the test user's data → fresh account for every run.
  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", userId)
    if (error) throw new Error(`E2E setup: failed clearing ${table}: ${error.message}`)
  }
}
