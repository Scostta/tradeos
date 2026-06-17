"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { loadInsightsInput } from "~/services/queries/insights"
import { generateInsightsFromInput } from "~/lib/ai/insights-client"
import { createDataResult, createErrorResult } from "~/helpers/result"
import { envServer } from "~/env/server"
import { generateInsightsInputSchema, MIN_TRADES_FOR_INSIGHTS } from "~/types/insights"
import type { ResultType } from "~/helpers/result"
import type { Insight } from "~/types/insights"

/**
 * Generates (or returns cached) AI insights for a scope. This is the only path
 * that hits the Anthropic API — and only when the data changed since the last
 * run (hash mismatch) or `refresh` is set. Account ownership is enforced before
 * any API call; the row is upserted by (user_id, account_id) scope.
 */
export async function generateInsights(
  input: unknown,
): Promise<ResultType<{ insights: Insight[]; cached: boolean }, string>> {
  const parsed = generateInsightsInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { accountId, refresh } = parsed.data

  // Verify account ownership when scoped to an account.
  if (accountId) {
    const { data: account } = await supabase
      .from("accounts").select("id").eq("id", accountId).eq("user_id", user.id).single()
    if (!account) return createErrorResult("ACCOUNT_NOT_FOUND")
  }

  const loaded = await loadInsightsInput(supabase, user.id, accountId)
  if (!loaded.success) return createErrorResult(loaded.error)
  const { input: insightsInput, hash, tradesCount } = loaded.data

  if (tradesCount < MIN_TRADES_FOR_INSIGHTS) return createErrorResult("INSUFFICIENT_DATA")

  // Cache hit: same data, no forced refresh → don't spend an API call.
  const existing = supabase.from("ai_insights").select("*").eq("user_id", user.id)
  const { data: row } = await (accountId == null
    ? existing.is("account_id", null)
    : existing.eq("account_id", accountId)
  ).maybeSingle()

  if (!refresh && row && row.input_hash === hash) {
    const cached = row.insights as Insight[]
    return createDataResult({ insights: cached, cached: true })
  }

  const result = await generateInsightsFromInput(insightsInput)
  if (!result.success) return createErrorResult(result.error)

  const payload = {
    user_id:      user.id,
    account_id:   accountId,
    input_hash:   hash,
    insights:     result.data,
    model:        envServer.ANTHROPIC_MODEL,
    trades_count: tradesCount,
    generated_at: new Date().toISOString(),
  }

  // Manual upsert (partial unique indexes don't play well with onConflict).
  const { error } = row
    ? await supabase.from("ai_insights").update(payload).eq("id", row.id)
    : await supabase.from("ai_insights").insert(payload)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/dashboard")
  revalidatePath("/insights")
  return createDataResult({ insights: result.data, cached: false })
}
