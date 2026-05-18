import { createClient } from "~/utils/supabase/server"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { computeDashboardMetrics, equityCurve, pnlByDayOfWeek } from "~/lib/calculations/metrics"
import { resolveDateRange } from "~/helpers/date-range"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { DashboardData, RangeKey } from "~/types/metrics"

export async function getDashboardData(
  range:     RangeKey,
  accountId: string | null = null,
): Promise<ResultType<DashboardData, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { from, to } = resolveDateRange(range)

  let query = supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .gte("entry_time", from)
    .lte("entry_time", to)
    .order("entry_time", { ascending: true })

  if (accountId) query = query.eq("account_id", accountId)

  const { data, error } = await query

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  const trades = data.map(row => mapTradeFromDb(row as Record<string, unknown>))

  const dashboardData: DashboardData = {
    metrics:      computeDashboardMetrics(trades),
    equityCurve:  equityCurve(trades),
    pnlByDow:     pnlByDayOfWeek(trades),
    recentTrades: [...trades].slice(-5).reverse(),
    hasTrades:    trades.length > 0,
  }

  return createDataResult(dashboardData)
}
