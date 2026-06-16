import { winRate, totalNetPnl } from "~/lib/calculations/metrics"
import type { Trade } from "~/types/trade"
import type { MistakeRow } from "~/types/reports"

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Aggregates trades by tagged mistake. A trade with several mistakes is counted
 * in each. Rows are sorted most-costly first (most negative net P&L).
 */
export function computeMistakeStats(trades: Trade[]): MistakeRow[] {
  const byMistake = new Map<string, Trade[]>()
  for (const t of trades) {
    for (const m of t.mistakes ?? []) {
      const bucket = byMistake.get(m) ?? []
      bucket.push(t)
      byMistake.set(m, bucket)
    }
  }

  return [...byMistake.entries()]
    .map(([label, ts]) => {
      const netPnl = totalNetPnl(ts)
      return {
        label,
        trades:  ts.length,
        netPnl:  round2(netPnl),
        avgPnl:  round2(netPnl / ts.length),
        winRate: winRate(ts),
      }
    })
    .sort((a, b) => a.netPnl - b.netPnl)
}
