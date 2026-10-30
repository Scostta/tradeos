"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { generateApiToken } from "~/helpers/api-token"
import { mapApiTokenFromDb } from "~/services/mappers/api-tokens"
import { createApiTokenInputSchema, revokeApiTokenInputSchema } from "~/types/api-token"
import type { ApiToken } from "~/types/api-token"
import { APP_URLS } from "~/constants/app-urls"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

/**
 * Crea un token para el add-on de NinjaTrader. Devuelve el token en claro: es
 * la única vez que existe fuera del add-on (en BD solo queda su hash).
 */
export async function createApiToken(
  input: unknown,
): Promise<ResultType<{ token: string; apiToken: ApiToken }, string>> {
  const parsed = createApiTokenInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { token, hash, prefix } = generateApiToken()

  const { data, error } = await supabase
    .from("api_tokens")
    .insert({
      user_id:      user.id,
      name:         parsed.data.name,
      token_hash:   hash,
      token_prefix: prefix,
    })
    .select("id, name, token_prefix, last_used_at, revoked_at, created_at")
    .single()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath(APP_URLS.TRADING_SETTINGS)
  return createDataResult({ token, apiToken: mapApiTokenFromDb(data) })
}

export async function revokeApiToken(
  input: unknown,
): Promise<ResultType<{ id: string }, string>> {
  const parsed = revokeApiTokenInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { error } = await supabase
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath(APP_URLS.TRADING_SETTINGS)
  return createDataResult({ id: parsed.data.id })
}
