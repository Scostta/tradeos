// ── Reports calculation layer ─────────────────────────────────────────────────
// All functions are pure: Trade[] in, aggregated data out.
// No async, no Supabase, no throws — errors surface as empty results.
//
// Autonomous decisions (documented per PM plan §3.1):
//   - avgVol: defined as mean of `contracts` per trade within the group
//     (not per trading day). Rationale: every trade has `contracts`; grouping
//     by day would dilute categories with few trades on many days.
//   - minTradesForWinRate: 5 — used in deriveInsights to avoid 100% win rate
//     from a single trade dominating the bestWinRate card.
//   - Cross-analysis top-N: 10 instrument columns (or fewer if < 10 instruments).
//   - Volume buckets: "1-4" / "5-9" / "10-19" / "20-49" / "50+" (matches design mock).
//   - Day-of-week groupBy includes Saturday & Sunday (0 and 6) to match mock.
//   - Month groupBy uses MMMM format (e.g. "January") for label.

import { winRate, totalNetPnl, avgWin, avgLoss, profitFactor, maxDrawdown } from "~/lib/calculations/metrics"
import type { Trade } from "~/types/trade"
import type { Playbook } from "~/types/playbook"
import type { ComparePeriodKey } from "~/helpers/compare-period"
import type {
  ReportRow,
  ReportInsights,
  CrossMatrix,
  CrossMatrixRow,
  ReportBreakdown,
  PerformanceSummary,
  CumPoint,
  AvgWinLossPoint,
  OverviewData,
  OverviewStats,
  OverviewHighlight,
  NetDailyPoint,
  ComparePeriod,
} from "~/types/reports"

// ── Shared date helpers ───────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" from an ISO timestamp using UTC. */
function toDateKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Groups trades by a computed date key into a Map<YYYY-MM-DD, Trade[]>. */
function groupByDateKey(trades: Trade[]): Map<string, Trade[]> {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const key = toDateKey(t.entryTime)
    const bucket = map.get(key) ?? []
    bucket.push(t)
    map.set(key, bucket)
  }
  return map
}

// ── groupBy helpers ───────────────────────────────────────────────────────────
// Each returns a string label for a trade, or null to exclude from the report.

const DOW_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
}

/** Groups by day of week (0=Sunday … 6=Saturday). Includes weekends. */
export function byDayOfWeek(trade: Trade): string {
  return DOW_LABELS[new Date(trade.entryTime).getDay()] ?? "Unknown"
}

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/** Groups by calendar month name (e.g. "March"). */
export function byMonth(trade: Trade): string {
  return MONTH_LABELS[new Date(trade.entryTime).getMonth()] ?? "Unknown"
}

/** Groups by instrument symbol (e.g. "NQ"). */
export function bySymbol(trade: Trade): string {
  return trade.instrument
}

/**
 * Groups by playbookId. Returns null for trades without a playbook, which
 * are excluded from the Playbooks sub-report.
 * The caller is responsible for replacing playbookId with the playbook name.
 */
export function byPlaybookId(trade: Trade): string | null {
  return trade.playbookId
}

/** Groups trades into "Wins" or "Losses" based on netPnl. */
export function byOutcome(trade: Trade): string {
  return trade.netPnl > 0 ? "Wins" : "Losses"
}

/**
 * Groups by contracts-volume bucket.
 * Buckets: "1-4" / "5-9" / "10-19" / "20-49" / "50+"
 */
export function byVolumeBucket(trade: Trade): string {
  const c = trade.contracts
  if (c <= 4)  return "1-4"
  if (c <= 9)  return "5-9"
  if (c <= 19) return "10-19"
  if (c <= 49) return "20-49"
  return "50+"
}

// ── Core aggregation ──────────────────────────────────────────────────────────

/**
 * Computes one ReportRow from a bucket of trades.
 * avgVol = mean(contracts) per trade (see file header for rationale).
 */
function computeRow(label: string, bucket: Trade[]): ReportRow {
  if (bucket.length === 0) {
    return { label, winRate: 0, pnl: 0, trades: 0, avgVol: 0, avgWin: 0, avgLoss: 0 }
  }
  const totalContracts = bucket.reduce((s, t) => s + t.contracts, 0)
  return {
    label,
    winRate: winRate(bucket),
    pnl:     totalNetPnl(bucket),
    trades:  bucket.length,
    avgVol:  totalContracts / bucket.length,
    avgWin:  avgWin(bucket),
    avgLoss: avgLoss(bucket),
  }
}

/**
 * Groups trades by groupBy, computes a ReportRow per group, and returns rows
 * sorted by absolute pnl descending (most impactful group first).
 *
 * Trades where groupBy returns null are excluded.
 *
 * @param trades   - filtered Trade[] (already scoped to account + date range)
 * @param groupBy  - function mapping a Trade to its category label (or null to skip)
 */
export function computeReportBreakdown(
  trades: Trade[],
  groupBy: (t: Trade) => string | null,
): ReportRow[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const key = groupBy(t)
    if (key === null) continue
    const bucket = map.get(key) ?? []
    bucket.push(t)
    map.set(key, bucket)
  }

  const rows: ReportRow[] = []
  for (const [label, bucket] of map) {
    rows.push(computeRow(label, bucket))
  }

  return rows.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
}

// ── Insights derivation ───────────────────────────────────────────────────────

const MIN_TRADES_FOR_WIN_RATE = 5

/**
 * Derives four insight cards from a rows array.
 * - best/worst: by pnl (most positive / most negative)
 * - mostActive: by trade count
 * - bestWinRate: by winRate, requiring >= MIN_TRADES_FOR_WIN_RATE trades
 *   to avoid a 1-trade 100% rate dominating the card. Falls back to the
 *   highest-winRate row regardless of count if no row meets the threshold.
 *
 * If rows is empty, returns zeroed-out insight objects.
 */
export function deriveInsights(rows: ReportRow[]): ReportInsights {
  if (rows.length === 0) {
    const empty = { label: "—", trades: 0, pnl: 0 }
    return {
      best:        empty,
      worst:       empty,
      mostActive:  { label: "—", trades: 0 },
      bestWinRate: { label: "—", winRate: 0, trades: 0 },
    }
  }

  const best     = rows.reduce((a, b) => (b.pnl > a.pnl ? b : a))
  const worst    = rows.reduce((a, b) => (b.pnl < a.pnl ? b : a))
  const active   = rows.reduce((a, b) => (b.trades > a.trades ? b : a))

  const qualified = rows.filter(r => r.trades >= MIN_TRADES_FOR_WIN_RATE)
  const winRateSource = qualified.length > 0 ? qualified : rows
  const topWR = winRateSource.reduce((a, b) => (b.winRate > a.winRate ? b : a))

  return {
    best:        { label: best.label,   trades: best.trades,   pnl: best.pnl },
    worst:       { label: worst.label,  trades: worst.trades,  pnl: worst.pnl },
    mostActive:  { label: active.label, trades: active.trades },
    bestWinRate: { label: topWR.label,  winRate: topWR.winRate, trades: topWR.trades },
  }
}

// ── Cross-analysis heatmap ────────────────────────────────────────────────────

/**
 * Builds a cross-analysis matrix: category rows × top-N instrument columns.
 *
 * - topN: number of instrument columns (default 10, capped to # unique instruments)
 * - Columns are the top-N instruments by total trade count across all trades.
 * - Each cell = sum of netPnl for trades matching (category label) × (instrument).
 * - Cells for intersections with 0 trades have v = 0.
 *
 * @param trades    - same filtered trades used for the rows
 * @param groupBy   - same groupBy function used for the rows (null trades excluded)
 * @param rows      - already-computed rows (used for label order and to avoid re-grouping)
 * @param topN      - max number of instrument columns
 */
export function computeCrossMatrix(
  trades: Trade[],
  groupBy: (t: Trade) => string | null,
  rows: ReportRow[],
  topN = 10,
): CrossMatrix {
  // Determine top-N instruments by trade count
  const instrCount = new Map<string, number>()
  for (const t of trades) {
    instrCount.set(t.instrument, (instrCount.get(t.instrument) ?? 0) + 1)
  }
  const cols = Array.from(instrCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([instr]) => instr)

  if (cols.length === 0 || rows.length === 0) {
    return { cols: [], rows: [] }
  }

  // Build pnl index: Map<"category::instrument", number>
  const pnlIndex = new Map<string, number>()
  for (const t of trades) {
    const category = groupBy(t)
    if (category === null) continue
    const key = `${category}::${t.instrument}`
    pnlIndex.set(key, (pnlIndex.get(key) ?? 0) + t.netPnl)
  }

  const matrixRows: CrossMatrixRow[] = rows.map(row => ({
    label: row.label,
    cells: cols.map(col => ({
      col,
      v: pnlIndex.get(`${row.label}::${col}`) ?? 0,
    })),
  }))

  return { cols, rows: matrixRows }
}

// ── Playbooks groupBy with name resolution ───────────────────────────────────

/**
 * Returns a groupBy function that maps trades to playbook names.
 * Trades with no playbookId are excluded (returns null).
 * Trades with a playbookId that has no matching Playbook record
 * are grouped under "Unknown Playbook".
 */
export function makeByPlaybookName(playbooks: Playbook[]): (t: Trade) => string | null {
  const nameById = new Map<string, string>()
  for (const s of playbooks) nameById.set(s.id, s.name)
  return (t: Trade): string | null => {
    if (t.playbookId === null) return null
    return nameById.get(t.playbookId) ?? "Unknown Playbook"
  }
}

// ── Day-ordering helper ───────────────────────────────────────────────────────

const DOW_ORDER: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
}

/**
 * Sorts ReportRow[] by canonical day-of-week order (Sunday first).
 * Rows whose label is not a weekday name are left at the end.
 */
export function sortByDayOfWeek(rows: ReportRow[]): ReportRow[] {
  return [...rows].sort((a, b) => {
    const oa = DOW_ORDER[a.label] ?? 99
    const ob = DOW_ORDER[b.label] ?? 99
    return oa - ob
  })
}

const MONTH_ORDER: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
}

/**
 * Sorts ReportRow[] by calendar month order (January first).
 */
export function sortByMonth(rows: ReportRow[]): ReportRow[] {
  return [...rows].sort((a, b) => {
    const oa = MONTH_ORDER[a.label] ?? 99
    const ob = MONTH_ORDER[b.label] ?? 99
    return oa - ob
  })
}

// ── Performance calculations ──────────────────────────────────────────────────

/**
 * Computes the full PerformanceSummary from Trade[].
 *
 * avgDailyVolume: mean of contracts per trade across all trades
 *   (same definition as avgVol in rows — documented in file header)
 * avgHoldTimeMs: mean of (exitTime.getTime() − entryTime.getTime()) per trade
 *   The frontend formats this to "Xh Ym" using the existing formatDuration helper.
 * maxDailyDrawdown: net P&L of the single worst trading day (most negative value).
 * avgDailyDrawdown: mean of per-day net P&L values that are negative.
 *   Both drawdown values return 0 if there are no losing days.
 * tradeExpectancy: (winRate * avgWin) + ((1 - winRate) * avgLoss)
 *   avgLoss is already negative, so the formula returns net expectancy per trade.
 * avgDailyWinLoss: (avg win-day P&L) / abs(avg loss-day P&L); 0 if no losing days.
 * avgTradeWinLoss: avgWin / abs(avgLoss); 0 if no losing trades.
 * avgDailyWinPct: fraction of trading days (days with ≥1 trade) that are net positive.
 */
export function computePerformanceSummary(trades: Trade[]): PerformanceSummary {
  if (trades.length === 0) {
    return {
      netPnl:           0,
      profitFactor:     0,
      winRate:          0,
      avgNetTradePnl:   0,
      avgDailyVolume:   0,
      avgDailyNetPnl:   0,
      loggedDays:       0,
      tradeExpectancy:  0,
      avgDailyWinLoss:  0,
      avgTradeWinLoss:  0,
      maxDailyDrawdown: 0,
      avgDailyDrawdown: 0,
      avgHoldTimeMs:    0,
      avgDailyWinPct:   0,
    }
  }

  const netPnl       = totalNetPnl(trades)
  const pf           = profitFactor(trades)
  const wr           = winRate(trades)
  const aw           = avgWin(trades)
  const al           = avgLoss(trades) // negative or 0

  const avgNetTradePnl  = netPnl / trades.length
  const totalContracts  = trades.reduce((s, t) => s + t.contracts, 0)
  const avgDailyVolume  = totalContracts / trades.length
  const tradeExpectancy = wr * aw + (1 - wr) * al
  const avgTradeWinLoss = al !== 0 ? aw / Math.abs(al) : 0

  // Hold time
  const totalHoldMs = trades.reduce((s, t) => {
    return s + (new Date(t.exitTime).getTime() - new Date(t.entryTime).getTime())
  }, 0)
  const avgHoldTimeMs = totalHoldMs / trades.length

  // Per-day aggregation
  const byDay = groupByDateKey(trades)
  const dayPnls = Array.from(byDay.values()).map(bucket =>
    bucket.reduce((s, t) => s + t.netPnl, 0),
  )

  const loggedDays      = dayPnls.length
  const avgDailyNetPnl  = loggedDays > 0 ? dayPnls.reduce((s, v) => s + v, 0) / loggedDays : 0

  const winDayPnls  = dayPnls.filter(v => v > 0)
  const lossDayPnls = dayPnls.filter(v => v < 0)

  const avgDailyWinPct  = loggedDays > 0 ? winDayPnls.length / loggedDays : 0
  const avgWinDayPnl    = winDayPnls.length  > 0 ? winDayPnls.reduce((s, v)  => s + v, 0) / winDayPnls.length  : 0
  const avgLossDayPnl   = lossDayPnls.length > 0 ? lossDayPnls.reduce((s, v) => s + v, 0) / lossDayPnls.length : 0
  const avgDailyWinLoss = avgLossDayPnl !== 0 ? avgWinDayPnl / Math.abs(avgLossDayPnl) : 0

  const maxDailyDrawdown = lossDayPnls.length > 0 ? Math.min(...lossDayPnls) : 0
  const avgDailyDrawdown = avgLossDayPnl // already the mean of negative values, or 0

  return {
    netPnl,
    profitFactor:     pf,
    winRate:          wr,
    avgNetTradePnl,
    avgDailyVolume,
    avgDailyNetPnl,
    loggedDays,
    tradeExpectancy,
    avgDailyWinLoss,
    avgTradeWinLoss,
    maxDailyDrawdown,
    avgDailyDrawdown,
    avgHoldTimeMs,
    avgDailyWinPct,
  }
}

// ── Chart series builders ─────────────────────────────────────────────────────

/**
 * Builds the cumulative equity series for the Performance area chart.
 * Trades are sorted by entryTime ascending; each point accumulates netPnl.
 * Returns one CumPoint per trade.
 */
export function buildCumPoints(trades: Trade[]): CumPoint[] {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime(),
  )
  let cumulative = 0
  return sorted.map(t => {
    cumulative += t.netPnl
    return { date: t.entryTime, v: cumulative }
  })
}

/**
 * Builds the avg daily win/loss bar series for the second Performance chart.
 *
 * Groups trades by calendar day (YYYY-MM-DD in UTC), then for each day computes:
 *   win:  avg netPnl of winning trades that day (> 0), or 0 if no winners
 *   loss: avg netPnl of losing trades that day (<= 0), or 0 if no losers
 *
 * Days are sorted chronologically.
 * label: "DD MMM" (e.g. "10 Mar") for axis display.
 */
export function buildAvgWinLoss(trades: Trade[]): AvgWinLossPoint[] {
  const byDay = groupByDateKey(trades)
  const entries = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))

  return entries.map(([dateKey, bucket]) => {
    const winners = bucket.filter(t => t.netPnl > 0)
    const losers  = bucket.filter(t => t.netPnl <= 0)

    const win  = winners.length > 0 ? winners.reduce((s, t) => s + t.netPnl, 0) / winners.length : 0
    const loss = losers.length  > 0 ? losers.reduce((s, t)  => s + t.netPnl, 0) / losers.length  : 0

    const [year, month, day] = dateKey.split("-").map(Number)
    const d = new Date(Date.UTC(year!, month! - 1, day!))
    const label = d.toLocaleDateString("en-US", { day: "2-digit", month: "short", timeZone: "UTC" })

    return { date: dateKey, label, win, loss }
  })
}

// ── Full breakdown builder ────────────────────────────────────────────────────

/**
 * Convenience wrapper that computes rows, insights, and cross matrix in one call.
 * Accepts an optional custom sort for the rows (e.g. sortByDayOfWeek).
 */
export function buildBreakdown(
  trades: Trade[],
  groupBy: (t: Trade) => string | null,
  sortRows?: (rows: ReportRow[]) => ReportRow[],
): ReportBreakdown {
  const rawRows = computeReportBreakdown(trades, groupBy)
  const rows    = sortRows ? sortRows(rawRows) : rawRows
  const insights = deriveInsights(rows)
  const cross    = computeCrossMatrix(trades, groupBy, rows)
  return { insights, rows, cross }
}

// ── Overview helpers ──────────────────────────────────────────────────────────

/** Max run length of `true` in a boolean sequence. */
function maxRun(flags: boolean[]): number {
  let max = 0
  let cur = 0
  for (const f of flags) {
    cur = f ? cur + 1 : 0
    if (cur > max) max = cur
  }
  return max
}

/** Mean hold time (ms) over a bucket of trades; 0 if empty. */
function avgHoldMs(bucket: Trade[]): number {
  if (bucket.length === 0) return 0
  const total = bucket.reduce(
    (s, t) => s + (new Date(t.exitTime).getTime() - new Date(t.entryTime).getTime()),
    0,
  )
  return total / bucket.length
}

/**
 * Peak-to-trough drawdown stats over the trade-ordered equity curve.
 * Returns the deepest dip below the running peak (max, negative) and the mean of
 * all below-peak dips (avg, negative). Both 0 when equity never dips below peak.
 */
function drawdownStats(trades: Trade[]): { max: number; avg: number } {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime(),
  )
  let peak = 0
  let equity = 0
  let max = 0
  const dips: number[] = []
  for (const t of sorted) {
    equity += t.netPnl
    if (equity > peak) peak = equity
    const dd = equity - peak // <= 0
    if (dd < 0) dips.push(dd)
    if (dd < max) max = dd
  }
  const avg = dips.length > 0 ? dips.reduce((s, v) => s + v, 0) / dips.length : 0
  return { max, avg }
}

/** "Mon YYYY" label for a "YYYY-MM" month key. */
function monthKeyLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  const d = new Date(Date.UTC(y!, m! - 1, 1))
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

/**
 * Computes the full Overview snapshot from Trade[].
 * Pure; returns zeroed highlights/stats and empty series for an empty input.
 */
export function computeOverview(trades: Trade[]): OverviewData {
  const emptyHighlight: OverviewHighlight = { value: 0, sub: "—" }

  if (trades.length === 0) {
    const zeroStats: OverviewStats = {
      totalPnl: 0, avgDailyVolume: 0, avgWinningTrade: 0, avgLosingTrade: 0,
      totalTrades: 0, winningTrades: 0, losingTrades: 0, maxConsecWins: 0,
      maxConsecLosses: 0, totalCommissions: 0, largestProfit: 0, largestLoss: 0,
      avgHoldAllMs: 0, avgHoldWinMs: 0, avgHoldLossMs: 0, avgTradePnl: 0,
      profitFactor: 0, tradingDays: 0, winningDays: 0, losingDays: 0,
      maxConsecWinDays: 0, maxConsecLossDays: 0, avgDailyPnl: 0,
      avgWinningDayPnl: 0, avgLosingDayPnl: 0, largestProfitDay: 0,
      largestLosingDay: 0, tradeExpectancy: 0, maxDrawdown: 0, avgDrawdown: 0,
    }
    return {
      highlights: { best: emptyHighlight, lowest: emptyHighlight, average: emptyHighlight },
      stats:      zeroStats,
      cumPoints:  [],
      netDaily:   [],
    }
  }

  const sorted = [...trades].sort(
    (a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime(),
  )

  const winners = sorted.filter(t => t.netPnl > 0)
  const losers  = sorted.filter(t => t.netPnl <= 0)
  const net     = totalNetPnl(sorted)

  // Per-month aggregation for the highlight cards
  const byMonth = new Map<string, number>()
  for (const t of sorted) {
    const d = new Date(t.entryTime)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    byMonth.set(key, (byMonth.get(key) ?? 0) + t.netPnl)
  }
  const monthEntries = Array.from(byMonth.entries())
  const bestMonth   = monthEntries.reduce((a, b) => (b[1] > a[1] ? b : a))
  const lowestMonth = monthEntries.reduce((a, b) => (b[1] < a[1] ? b : a))
  const avgMonth    = monthEntries.reduce((s, [, v]) => s + v, 0) / monthEntries.length

  // Per-day aggregation
  const byDay = groupByDateKey(sorted)
  const dayEntries = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))
  const dayPnls   = dayEntries.map(([, b]) => b.reduce((s, t) => s + t.netPnl, 0))
  const netDaily: NetDailyPoint[] = dayEntries.map(([date], i) => ({ date, v: dayPnls[i]! }))
  const winDays  = dayPnls.filter(v => v > 0)
  const lossDays = dayPnls.filter(v => v < 0)

  const dd = drawdownStats(sorted)

  const stats: OverviewStats = {
    totalPnl:          net,
    avgDailyVolume:    sorted.reduce((s, t) => s + t.contracts, 0) / sorted.length,
    avgWinningTrade:   avgWin(sorted),
    avgLosingTrade:    avgLoss(sorted),
    totalTrades:       sorted.length,
    winningTrades:     winners.length,
    losingTrades:      losers.length,
    maxConsecWins:     maxRun(sorted.map(t => t.netPnl > 0)),
    maxConsecLosses:   maxRun(sorted.map(t => t.netPnl <= 0)),
    totalCommissions:  -sorted.reduce((s, t) => s + t.commission, 0),
    largestProfit:     Math.max(0, ...sorted.map(t => t.netPnl)),
    largestLoss:       Math.min(0, ...sorted.map(t => t.netPnl)),
    avgHoldAllMs:      avgHoldMs(sorted),
    avgHoldWinMs:      avgHoldMs(winners),
    avgHoldLossMs:     avgHoldMs(losers),
    avgTradePnl:       net / sorted.length,
    profitFactor:      profitFactor(sorted),
    tradingDays:       dayEntries.length,
    winningDays:       winDays.length,
    losingDays:        lossDays.length,
    maxConsecWinDays:  maxRun(dayPnls.map(v => v > 0)),
    maxConsecLossDays: maxRun(dayPnls.map(v => v < 0)),
    avgDailyPnl:       dayPnls.reduce((s, v) => s + v, 0) / dayEntries.length,
    avgWinningDayPnl:  winDays.length  > 0 ? winDays.reduce((s, v) => s + v, 0)  / winDays.length  : 0,
    avgLosingDayPnl:   lossDays.length > 0 ? lossDays.reduce((s, v) => s + v, 0) / lossDays.length : 0,
    largestProfitDay:  Math.max(0, ...dayPnls),
    largestLosingDay:  Math.min(0, ...dayPnls),
    tradeExpectancy:   winRate(sorted) * avgWin(sorted) + (1 - winRate(sorted)) * avgLoss(sorted),
    maxDrawdown:       dd.max,
    avgDrawdown:       dd.avg,
  }

  return {
    highlights: {
      best:    { value: bestMonth[1],   sub: `in ${monthKeyLabel(bestMonth[0])}` },
      lowest:  { value: lowestMonth[1], sub: `in ${monthKeyLabel(lowestMonth[0])}` },
      average: { value: avgMonth,       sub: "per month" },
    },
    stats,
    cumPoints: buildCumPoints(sorted),
    netDaily,
  }
}

// ── Compare period ────────────────────────────────────────────────────────────

/**
 * Computes the head-to-head metrics for one comparison period. Reuses the
 * Performance summary for the shared figures and the peak-to-trough maxDrawdown.
 */
export function computeComparePeriod(
  trades: Trade[],
  key:    ComparePeriodKey,
  label:  string,
  sub:    string,
): ComparePeriod {
  const s = computePerformanceSummary(trades)
  return {
    key,
    label,
    sub,
    net:             s.netPnl,
    trades:          trades.length,
    winRate:         s.winRate,
    profitFactor:    s.profitFactor,
    avgDailyNetPnl:  s.avgDailyNetPnl,
    maxDrawdown:     maxDrawdown(trades),
    tradeExpectancy: s.tradeExpectancy,
    avgHoldTimeMs:   s.avgHoldTimeMs,
  }
}
