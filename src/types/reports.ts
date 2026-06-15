// ── Reports domain types ──────────────────────────────────────────────────────
// These types describe the data that getReportsData() returns.
// All aggregation happens server-side; client components receive these shapes
// as props and only manage local UI state (sort, sub-tab selection, hover).
//
// Deferred / not sourced in Phase 1 (D1 decision):
//   - avgPlannedR   — needs stopPrice + target; NinjaTrader CSV does not export target
//   - avgRealizedR  — same dependency as avgPlannedR
//   - totalFees     — NinjaTrader exports a single "Commission" field, no separate fees
//   - totalSwap     — irrelevant for futures; no source
//   - breakEvenTrades — needs a threshold definition; deferred to Phase 2

// ── Row & insight types (shared by all 4 sub-reports) ─────────────────────────

/**
 * One row in the summary table of a sub-report.
 *
 * - label    : category name (e.g. "Wednesday", "NQ", "Trend", "Wins")
 * - winRate  : 0–1 fraction (not percentage)
 * - pnl      : total net P&L for the category
 * - trades   : number of trades in the category
 * - avgVol   : average contracts per trade in the category
 *              (autonomous decision: avg contracts per trade, not per day — documented
 *              in computeReportBreakdown JSDoc)
 * - avgWin   : average net P&L of winning trades in the category (positive)
 * - avgLoss  : average net P&L of losing trades in the category (negative or 0)
 */
export type ReportRow = {
  label:   string
  winRate: number
  pnl:     number
  trades:  number
  avgVol:  number
  avgWin:  number
  avgLoss: number
}

/**
 * Four headline figures shown as insight cards above each sub-report chart.
 *
 * Each insight carries enough context for an InsightCard to render without
 * needing the full rows array.
 */
export type ReportInsights = {
  best:        { label: string; trades: number; pnl: number }
  worst:       { label: string; trades: number; pnl: number }
  mostActive:  { label: string; trades: number }
  bestWinRate: { label: string; winRate: number; trades: number }
}

/**
 * Cross-analysis heatmap: category rows × top-N instrument columns.
 *
 * cols: ordered list of instrument symbols (top-N by total trade count)
 * rows: one entry per category label, with one cell per column
 * cells are ordered to match cols exactly (same index)
 */
export type CrossMatrixCell = {
  col: string  // instrument symbol
  v:   number  // net P&L for this category × instrument intersection
}

export type CrossMatrixRow = {
  label: string
  cells: CrossMatrixCell[]
}

export type CrossMatrix = {
  cols: string[]
  rows: CrossMatrixRow[]
}

/**
 * Complete data for one sub-report (Day & Time / Symbols / Strategies / Wins vs Losses).
 *
 * The frontend ReportDetail component destructures this directly.
 */
export type ReportBreakdown = {
  insights: ReportInsights
  rows:     ReportRow[]
  cross:    CrossMatrix
}

// ── Performance tab types ─────────────────────────────────────────────────────

/**
 * One data point in the cumulative equity series.
 * Uses `entryTime` (ISO string) as the date axis.
 * v is cumulative net P&L at that point.
 */
export type CumPoint = {
  date:  string   // ISO string — entryTime of the trade
  v:     number   // cumulative net P&L
}

/**
 * One data point in the avg daily win/loss bar series.
 * Used by the second chart on the Performance tab.
 *
 * label: "DD MMM" formatted date key (e.g. "10 Mar")
 * win:   average net P&L of winning trades on that day (positive, or 0 if no winners)
 * loss:  average net P&L of losing trades on that day (negative, or 0 if no losers)
 */
export type AvgWinLossPoint = {
  date:  string   // YYYY-MM-DD key
  label: string   // "DD MMM" for axis display
  win:   number
  loss:  number
}

/**
 * The computable subset of the Performance summary grid (16 cells in the design).
 *
 * Fields intentionally absent (deferred per D1):
 *   avgPlannedR, avgRealizedR — no source in existing schema
 *
 * avgDailyWinLoss: ratio avgDailyWin / abs(avgDailyLoss); 0 if no losing days
 * avgTradeWinLoss: ratio avgWin / abs(avgLoss) at trade level; 0 if no losers
 * avgDailyWinPct: fraction of trading days where net > 0 (0–1)
 * avgHoldTimeMs: mean hold duration in milliseconds (exitTime − entryTime)
 *   — the frontend converts this to "Xh Ym" using formatDuration helpers
 * loggedDays: count of distinct calendar dates where ≥1 trade occurred
 */
export type PerformanceSummary = {
  netPnl:            number
  profitFactor:      number
  winRate:           number   // 0–1
  avgNetTradePnl:    number
  avgDailyVolume:    number   // avg contracts per trade across all trades (see note below)
  avgDailyNetPnl:    number   // avg net P&L per trading day
  loggedDays:        number   // distinct days with ≥1 trade
  tradeExpectancy:   number   // winRate * avgWin + (1 - winRate) * |avgLoss|
  avgDailyWinLoss:   number   // ratio of avg daily win / avg daily |loss|; 0 if no losing days
  avgTradeWinLoss:   number   // ratio of avgWin / |avgLoss| at trade level; 0 if no losers
  maxDailyDrawdown:  number   // most negative single-day net P&L (negative value)
  avgDailyDrawdown:  number   // mean of negative-day net P&L values (negative value); 0 if no losing days
  avgHoldTimeMs:     number   // mean of (exitTime − entryTime) in milliseconds
  avgDailyWinPct:    number   // 0–1 fraction of trading days that are net positive
  // avgPlannedR and avgRealizedR are OMITTED — see file header
}

// ── Overview tab types ────────────────────────────────────────────────────────
//
// The Overview is a single-account-style snapshot of all-time stats. Every field
// below is derivable from the existing trades; fields shown in the design mock but
// NOT sourced from the NinjaTrader CSV are intentionally omitted (D1 decision):
//   - Break-even trades / days / "Scratch" hold time — needs a break-even threshold
//   - Total fees / Total swap — CSV exports only a single "Commission" field
//   - Open trades — the parser ignores trades without an Exit time (none are open)
//   - Planned / realized R-multiples — needs a target price (not in the CSV)
//   - Max / Average drawdown % — needs accounts.initial_balance (optional, and
//     undefined in the "all accounts" aggregate view)

import type { ComparePeriodKey } from "~/helpers/compare-period"

/** A headline figure (best/lowest/average month) with a contextual sub-label. */
export type OverviewHighlight = {
  value: number
  sub:   string   // "in Jun 2025" | "per month"
}

/** One point in the net-daily-P&L bar series. */
export type NetDailyPoint = {
  date: string   // YYYY-MM-DD
  v:    number   // net P&L for that day
}

/**
 * All-time numeric stats for the Overview tab. The frontend formats each value
 * (currency / count / duration / ratio) when building its two stat columns.
 *
 * maxDrawdown / avgDrawdown are peak-to-trough equity drawdowns (negative):
 *   - maxDrawdown: deepest equity dip below its running peak
 *   - avgDrawdown: mean of all below-peak dips along the equity curve
 */
export type OverviewStats = {
  // Trade-level
  totalPnl:          number
  avgDailyVolume:    number
  avgWinningTrade:   number
  avgLosingTrade:    number
  totalTrades:       number
  winningTrades:     number
  losingTrades:      number
  maxConsecWins:     number
  maxConsecLosses:   number
  totalCommissions:  number   // negative (cost)
  largestProfit:     number
  largestLoss:       number
  avgHoldAllMs:      number
  avgHoldWinMs:      number
  avgHoldLossMs:     number
  avgTradePnl:       number
  profitFactor:      number
  // Day-level
  tradingDays:       number
  winningDays:       number
  losingDays:        number
  maxConsecWinDays:  number
  maxConsecLossDays: number
  avgDailyPnl:       number
  avgWinningDayPnl:  number
  avgLosingDayPnl:   number
  largestProfitDay:  number
  largestLosingDay:  number
  tradeExpectancy:   number
  maxDrawdown:       number
  avgDrawdown:       number
}

export type OverviewData = {
  highlights: {
    best:    OverviewHighlight   // best calendar month
    lowest:  OverviewHighlight   // worst calendar month
    average: OverviewHighlight   // average per month
  }
  stats:     OverviewStats
  cumPoints: CumPoint[]          // reuses the Performance cumulative series
  netDaily:  NetDailyPoint[]
}

// ── Compare tab types ─────────────────────────────────────────────────────────

/**
 * Head-to-head metrics for one period. Every field is a subset of the figures
 * already computed for the Performance summary, plus a peak-to-trough maxDrawdown.
 */
export type ComparePeriod = {
  key:             ComparePeriodKey
  label:           string   // "This month"
  sub:             string   // "Jun 2025"
  net:             number
  trades:          number
  winRate:         number   // 0–1
  profitFactor:    number
  avgDailyNetPnl:  number
  maxDrawdown:     number   // negative (peak-to-trough)
  tradeExpectancy: number
  avgHoldTimeMs:   number
}

export type CompareData = {
  a: ComparePeriod
  b: ComparePeriod
}

// ── Top-level ReportsData ─────────────────────────────────────────────────────

/**
 * Complete data returned by getReportsData(). The page.tsx receives this,
 * then passes slices down to each tab/component as props.
 *
 * hasTrades: false when trades array is empty — page shows empty state
 */
export type ReportsData = {
  hasTrades:          boolean
  performanceSummary: PerformanceSummary
  cumPoints:          CumPoint[]          // for the cumulative area chart
  avgWinLoss:         AvgWinLossPoint[]   // for the avg daily win/loss bar chart
  dayTime:            ReportBreakdown     // Day & Time sub-report (grouped by weekday)
  months:             ReportBreakdown     // Day & Time / Months sub-tab
  symbols:            ReportBreakdown     // Symbols sub-report
  strategies:         ReportBreakdown     // Strategies (Playbooks) sub-report
  winsLosses:         ReportBreakdown     // Wins vs Losses sub-report
  overview:           OverviewData        // Overview tab (all-time snapshot)
  compare:            CompareData         // Compare tab default (this vs last month)
}
