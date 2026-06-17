import type { ReportsData, ReportRow } from "~/types/reports"
import type { ReportSnapshot, ShareBreakdownRow } from "~/types/report-share"

const toRow = (r: ReportRow): ShareBreakdownRow => ({
  label:   r.label,
  trades:  r.trades,
  winRate: r.winRate,
  pnl:     r.pnl,
})

/** Builds the curated, frozen snapshot from a full ReportsData. No raw trades. */
export function buildReportSnapshot(
  data: ReportsData,
  accountLabel: string,
  rangeLabel: string,
): ReportSnapshot {
  const ps = data.performanceSummary
  const ov = data.overview.stats
  return {
    version:      1,
    accountLabel,
    rangeLabel,
    generatedAt:  new Date().toISOString(),
    kpis: {
      netPnl:         ps.netPnl,
      winRate:        ps.winRate,
      profitFactor:   ps.profitFactor,
      totalTrades:    ov.totalTrades,
      tradingDays:    ov.tradingDays,
      avgDailyNetPnl: ps.avgDailyNetPnl,
      expectancy:     ps.tradeExpectancy,
      maxDrawdown:    ov.maxDrawdown,
      avgHoldTimeMs:  ov.avgHoldAllMs,
    },
    equity:       data.cumPoints.map((p) => p.v),
    byDayOfWeek:  data.dayTime.rows.map(toRow),
    byInstrument: data.symbols.rows.map(toRow),
  }
}
