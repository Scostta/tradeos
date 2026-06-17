// ── Reports query ─────────────────────────────────────────────────────────────
// Fetches trades (and playbooks for name resolution) once, then delegates
// all aggregation to pure functions in lib/calculations/reports.ts.
//
// Pattern mirrors getDashboardData (src/services/queries/dashboard.ts):
//   auth → filter by user_id + optional account_id + optional date range → map → calc
//
// "all" range: no date filter is applied (full account history).
// accountId null: no account filter — all accounts for the authenticated user
//   (RLS on trades already restricts to auth.uid() = user_id).

import { cache } from "react"
import { createClient } from "~/utils/supabase/server"
import { mapTradeFromDb } from "~/services/mappers/trades"
import { mapPlaybookFromDb } from "~/services/mappers/playbooks"
import { resolveDateRange } from "~/helpers/date-range"
import { resolveComparePeriod } from "~/helpers/compare-period"
import { getUserTimezone } from "~/services/queries/profile"
import { createDataResult, createErrorResult } from "~/helpers/result"
import {
  computePerformanceSummary,
  computeOverview,
  computeComparePeriod,
  buildCumPoints,
  buildAvgWinLoss,
  buildBreakdown,
  makeByPlaybookName,
  byDayOfWeek,
  byMonth,
  bySymbol,
  byOutcome,
  sortByDayOfWeek,
  sortByMonth,
} from "~/lib/calculations/reports"
import { computeRStats } from "~/lib/calculations/r-multiples"
import { computePortfolioAdherence } from "~/lib/calculations/playbook-adherence"
import { computeMistakeStats } from "~/lib/calculations/mistakes"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import type { ParsedRules } from "~/helpers/playbook-rules"
import type { ResultType } from "~/helpers/result"
import type { ReportsData, ComparePeriod } from "~/types/reports"
import type { ComparePeriodKey } from "~/helpers/compare-period"
import type { TradesRange } from "~/types/trade-filters"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Fetches trades for one comparison window and computes its head-to-head metrics.
 * Shared by getReportsData (default this-month vs last-month) and the
 * compareReportsPeriods server action (user-selected periods).
 *
 * Window is half-open [from, to): `.gte(from).lt(to)`. `from === null` (the
 * "all" period) applies no lower bound.
 */
export async function buildComparePeriod(
  supabase:  SupabaseServerClient,
  userId:    string,
  accountId: string | null,
  key:       ComparePeriodKey,
  timeZone = "UTC",
): Promise<ResultType<ComparePeriod, string>> {
  const w = resolveComparePeriod(key)

  let query = supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .lt("entry_time", w.to)
    .order("entry_time", { ascending: true })

  if (w.from)     query = query.gte("entry_time", w.from)
  if (accountId)  query = query.eq("account_id", accountId)

  const { data, error } = await query
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  const trades = (data ?? []).map(row => mapTradeFromDb(row as Record<string, unknown>))
  return createDataResult(computeComparePeriod(trades, key, w.label, w.sub, timeZone))
}

/**
 * Fetches all data required to render the Reports page (Phase 1 MVP).
 *
 * @param accountId - UUID of the active account, or null for "Todas las cuentas"
 * @param range     - "all" (no date filter) or a RangeKey for resolveDateRange
 *
 * Returns ResultType<ReportsData, string>:
 *   - success: false with "UNAUTHENTICATED" if no session
 *   - success: false with the Supabase error message on DB errors
 *   - success: true with the full ReportsData shape
 *
 * Uses React.cache() so multiple Server Components on the same render can call
 * this function without duplicating the DB round-trip.
 */
export const getReportsData = cache(async function getReportsData(
  accountId: string | null,
  range: TradesRange,
): Promise<ResultType<ReportsData, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const timeZone = await getUserTimezone()
  const dateRange = range !== "all" ? resolveDateRange(range, timeZone) : null

  // ── Fetch trades ────────────────────────────────────────────────────────────
  let tradesQuery = supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_time", { ascending: true })

  if (dateRange)  tradesQuery = tradesQuery.gte("entry_time", dateRange.from).lte("entry_time", dateRange.to)
  if (accountId)  tradesQuery = tradesQuery.eq("account_id", accountId)

  const { data: tradesData, error: tradesError } = await tradesQuery

  if (tradesError) {
    console.error(tradesError)
    return createErrorResult(tradesError.message)
  }

  // ── Fetch playbooks (for name resolution in Playbooks sub-report) ─────────
  const { data: playbooksData, error: playbooksError } = await supabase
    .from("playbooks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (playbooksError) {
    console.error(playbooksError)
    return createErrorResult(playbooksError.message)
  }

  // ── Fetch accounts' risk_per_trade (R-multiple fallback when a trade has no stop) ─
  const { data: accountsData, error: accountsError } = await supabase
    .from("accounts")
    .select("id, risk_per_trade")
    .eq("user_id", user.id)

  if (accountsError) {
    console.error(accountsError)
    return createErrorResult(accountsError.message)
  }

  const riskByAccount = new Map<string, number | null>(
    (accountsData ?? []).map(a => [a.id, a.risk_per_trade])
  )

  // ── Map to domain types ─────────────────────────────────────────────────────
  const trades     = (tradesData ?? []).map(row => mapTradeFromDb(row as Record<string, unknown>))
  const playbooks = (playbooksData ?? []).map(row => mapPlaybookFromDb(row as Record<string, unknown>))

  // ── Early return for empty state ────────────────────────────────────────────
  if (trades.length === 0) {
    const emptyBreakdown = {
      insights: {
        best:        { label: "—", trades: 0, pnl: 0 },
        worst:       { label: "—", trades: 0, pnl: 0 },
        mostActive:  { label: "—", trades: 0 },
        bestWinRate: { label: "—", winRate: 0, trades: 0 },
      },
      rows:  [],
      cross: { cols: [], rows: [] },
    }

    // No fetch: the page renders the empty-state CTA (not the tabs) when
    // hasTrades is false, so compare/overview here are placeholders only.
    const emptyComparePeriod = (key: ComparePeriodKey): ComparePeriod => {
      const w = resolveComparePeriod(key)
      return computeComparePeriod([], key, w.label, w.sub, timeZone)
    }

    return createDataResult<ReportsData>({
      hasTrades:          false,
      performanceSummary: computePerformanceSummary([], timeZone),
      cumPoints:          [],
      avgWinLoss:         [],
      dayTime:            emptyBreakdown,
      months:             emptyBreakdown,
      symbols:            emptyBreakdown,
      playbooks:         emptyBreakdown,
      winsLosses:         emptyBreakdown,
      overview:           computeOverview([], timeZone),
      compare:            { a: emptyComparePeriod("this-month"), b: emptyComparePeriod("last-month") },
      rStats:             computeRStats([]),
      playbookAdherence:  null,
      mistakes:           [],
    })
  }

  // ── Compute all aggregations ────────────────────────────────────────────────
  const byPlaybookName = makeByPlaybookName(playbooks)
  const rulesById = new Map<string, ParsedRules>(
    playbooks.map(p => [p.id, parsePlaybookRules(p.rules)])
  )

  // Compare defaults are independent of the page range — fetched on their own
  // windows (this month vs last month).
  const [compareA, compareB] = await Promise.all([
    buildComparePeriod(supabase, user.id, accountId, "this-month", timeZone),
    buildComparePeriod(supabase, user.id, accountId, "last-month", timeZone),
  ])
  if (!compareA.success) return createErrorResult(compareA.error)
  if (!compareB.success) return createErrorResult(compareB.error)

  const reportsData: ReportsData = {
    hasTrades:          true,
    performanceSummary: computePerformanceSummary(trades, timeZone),
    cumPoints:          buildCumPoints(trades),
    avgWinLoss:         buildAvgWinLoss(trades, timeZone),
    dayTime:            buildBreakdown(trades, byDayOfWeek(timeZone), sortByDayOfWeek),
    months:             buildBreakdown(trades, byMonth(timeZone), sortByMonth),
    symbols:            buildBreakdown(trades, bySymbol),
    playbooks:         buildBreakdown(trades, byPlaybookName),
    winsLosses:         buildBreakdown(trades, byOutcome),
    overview:           computeOverview(trades, timeZone),
    compare:            { a: compareA.data, b: compareB.data },
    rStats:             computeRStats(trades, riskByAccount),
    playbookAdherence:  computePortfolioAdherence(rulesById, trades, riskByAccount),
    mistakes:           computeMistakeStats(trades),
  }

  return createDataResult(reportsData)
})
