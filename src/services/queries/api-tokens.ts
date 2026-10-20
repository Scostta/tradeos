// ── API tokens query ──────────────────────────────────────────────────────────
// Tokens activos del usuario para la card de sincronización de /settings.
// Los revocados no se listan (no se pueden reactivar).

import { createClient } from "~/utils/supabase/server"
import { mapApiTokenFromDb } from "~/services/mappers/api-tokens"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { ApiToken } from "~/types/api-token"

export async function getApiTokens(): Promise<ResultType<ApiToken[], string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, name, token_prefix, last_used_at, revoked_at, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  return createDataResult((data ?? []).map(mapApiTokenFromDb))
}
