"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { updateGoalsInputSchema } from "~/types/goals"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

export async function updateGoals(input: unknown): Promise<ResultType<{ ok: true }, string>> {
  const parsed = updateGoalsInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const g = parsed.data
  const { error } = await supabase
    .from("user_goals")
    .upsert({
      user_id:            user.id,
      monthly_pnl_target: g.monthlyPnlTarget,
      win_rate_target:    g.winRateTarget,
      max_drawdown_limit: g.maxDrawdownLimit,
      min_trading_days:   g.minTradingDays,
      updated_at:         new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/dashboard")
  return createDataResult({ ok: true })
}
