import { createClient } from "~/utils/supabase/server"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { computeGoalsProgress } from "~/lib/calculations/goals"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { Goals, GoalsProgress } from "~/types/goals"

function mapGoals(row: Record<string, unknown> | null): Goals {
  return {
    monthlyPnlTarget: (row?.["monthly_pnl_target"] as number | null) ?? null,
    winRateTarget:    (row?.["win_rate_target"] as number | null) ?? null,
    maxDrawdownLimit: (row?.["max_drawdown_limit"] as number | null) ?? null,
    minTradingDays:   (row?.["min_trading_days"] as number | null) ?? null,
  }
}

/**
 * The user's monthly goals plus progress over the current calendar month
 * (all accounts). `goals` is all-null when nothing has been set yet.
 */
export async function getGoalsWithProgress(): Promise<ResultType<{ goals: Goals; progress: GoalsProgress }, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const now        = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })

  const [goalsRes, tradesRes] = await Promise.all([
    supabase.from("user_goals").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("trades").select("*").eq("user_id", user.id).gte("entry_time", monthStart),
  ])

  if (goalsRes.error)  { console.error(goalsRes.error);  return createErrorResult(goalsRes.error.message) }
  if (tradesRes.error) { console.error(tradesRes.error); return createErrorResult(tradesRes.error.message) }

  const goals  = mapGoals(goalsRes.data ?? null)
  const trades = (tradesRes.data ?? []).map(row => mapTradeFromDb(row as Record<string, unknown>))

  return createDataResult({ goals, progress: computeGoalsProgress(goals, trades, monthLabel) })
}
