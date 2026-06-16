"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { updateGoalsInputSchema, deleteGoalsInputSchema } from "~/types/goals"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

export async function updateGoals(input: unknown): Promise<ResultType<{ ok: true }, string>> {
  const parsed = updateGoalsInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { accountId, ...targets } = parsed.data

  // Verify account ownership when scoping to an account.
  if (accountId) {
    const { data: account } = await supabase
      .from("accounts").select("id").eq("id", accountId).eq("user_id", user.id).single()
    if (!account) return createErrorResult("ACCOUNT_NOT_FOUND")
  }

  // Manual upsert (partial unique indexes don't play well with onConflict).
  const existing = supabase.from("user_goals").select("id").eq("user_id", user.id)
  const { data: row } = await (accountId == null
    ? existing.is("account_id", null)
    : existing.eq("account_id", accountId)
  ).maybeSingle()

  const payload = {
    user_id:            user.id,
    account_id:         accountId,
    monthly_pnl_target: targets.monthlyPnlTarget,
    win_rate_target:    targets.winRateTarget,
    max_drawdown_limit: targets.maxDrawdownLimit,
    min_trading_days:   targets.minTradingDays,
    updated_at:         new Date().toISOString(),
  }

  const { error } = row
    ? await supabase.from("user_goals").update(payload).eq("id", row.id)
    : await supabase.from("user_goals").insert(payload)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/dashboard")
  revalidatePath("/goals")
  return createDataResult({ ok: true })
}

export async function deleteGoals(input: unknown): Promise<ResultType<{ ok: true }, string>> {
  const parsed = deleteGoalsInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { accountId } = parsed.data
  const base = supabase.from("user_goals").delete().eq("user_id", user.id)
  const { error } = await (accountId == null ? base.is("account_id", null) : base.eq("account_id", accountId))

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/dashboard")
  revalidatePath("/goals")
  return createDataResult({ ok: true })
}
