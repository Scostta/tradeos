import { createClient } from "~/utils/supabase/server"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { computeDashboardMetrics, equityCurve, pnlByDayOfWeek } from "~/lib/calculations/metrics"
import { resolveDateRange } from "~/helpers/date-range"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { DashboardData } from "~/types/metrics"
import type { TradesRange } from "~/types/trade-filters"

export async function getDashboardData(
  range:     TradesRange,
  accountId: string | null = null,
): Promise<ResultType<DashboardData, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const dateRange = range !== "all" ? resolveDateRange(range) : null

  let query = supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_time", { ascending: true })

  if (dateRange)  query = query.gte("entry_time", dateRange.from).lte("entry_time", dateRange.to)
  if (accountId)  query = query.eq("account_id", accountId)

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
