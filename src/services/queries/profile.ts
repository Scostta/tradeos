// ── User profile query ────────────────────────────────────────────────────────
// Reads the user's profile row, or returns sensible defaults when none exists
// yet (no row is created until the user saves their preferences for the first
// time — the update action upserts). Used by the layout (sidebar name) and
// the /settings page.

import { cache } from "react"
import { createClient } from "~/utils/supabase/server"
import { mapProfileFromDb } from "~/services/mappers/profiles"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { Profile } from "~/types/profile"

export const getProfile = cache(async function getProfile(): Promise<ResultType<Profile, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  if (!data) {
    const now = new Date().toISOString()
    return createDataResult<Profile>({
      userId:          user.id,
      displayName:     null,
      timezone:        "UTC",
      defaultCurrency: "USD",
      createdAt:       now,
      updatedAt:       now,
    })
  }

  return createDataResult(mapProfileFromDb(data))
})

/**
 * The user's IANA timezone, or "UTC" as a safe default. Thin wrapper over
 * getProfile() (cached) so the calculation queries can thread the zone without
 * unwrapping a ResultType each time.
 */
export const getUserTimezone = cache(async function getUserTimezone(): Promise<string> {
  const result = await getProfile()
  return result.success ? result.data.timezone : "UTC"
})
