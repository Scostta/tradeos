import type { Trade } from "~/types/trade"
import type { RStats, RBucket } from "~/types/reports"
import { pointValue } from "~/lib/calculations/pnl"

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Realized R-multiple of a trade = net P&L ÷ initial risk.
 * Initial risk ($) = |entry − stop| × contracts × point value.
 * Returns null when the trade has no stop, an unknown instrument, or zero risk
 * (those trades are excluded from R stats — see `coverage`).
 */
export function rMultiple(trade: Trade): number | null {
  const pv = pointValue(trade.instrument)
  if (pv == null || trade.stopPrice == null) return null
  const risk = Math.abs(trade.entryPrice - trade.stopPrice) * trade.contracts * pv
  if (!(risk > 0)) return null
  return trade.netPnl / risk
}

// Histogram edges in R. Index i covers (EDGES[i], EDGES[i+1]].
const EDGES  = [-Infinity, -3, -2, -1, 0, 1, 2, 3, Infinity]
const LABELS = ["≤−3R", "−3..−2", "−2..−1", "−1..0", "0..1", "1..2", "2..3", "≥3R"]

function emptyDistribution(): RBucket[] {
  return LABELS.map((label, i) => ({ label, count: 0, negative: EDGES[i + 1]! <= 0 }))
}

function bucketize(rs: number[]): RBucket[] {
  const dist = emptyDistribution()
  for (const r of rs) {
    let idx = EDGES.findIndex((_, i) => i < EDGES.length - 1 && r > EDGES[i]! && r <= EDGES[i + 1]!)
    if (idx === -1) idx = r <= -3 ? 0 : LABELS.length - 1
    dist[idx]!.count += 1
  }
  return dist
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

export function computeRStats(trades: Trade[]): RStats {
  const rs = trades.map(rMultiple).filter((r): r is number => r != null)
  const withR = rs.length

  if (withR === 0) {
    return {
      coverage:     { withR: 0, total: trades.length },
      expectancy:   0,
      totalR:       0,
      avgRWin:      0,
      avgRLoss:     0,
      winRate:      0,
      sqn:          0,
      bestR:        0,
      worstR:       0,
      distribution: emptyDistribution(),
    }
  }

  const wins   = rs.filter(r => r > 0)
  const losses = rs.filter(r => r <= 0)
  const expectancy = mean(rs)
  const variance   = mean(rs.map(r => (r - expectancy) ** 2))
  const std        = Math.sqrt(variance)

  return {
    coverage:     { withR, total: trades.length },
    expectancy:   round2(expectancy),
    totalR:       round2(rs.reduce((s, r) => s + r, 0)),
    avgRWin:      round2(mean(wins)),
    avgRLoss:     round2(mean(losses)),
    winRate:      withR ? wins.length / withR : 0,
    sqn:          std > 0 ? round2((expectancy / std) * Math.sqrt(withR)) : 0,
    bestR:        round2(Math.max(...rs)),
    worstR:       round2(Math.min(...rs)),
    distribution: bucketize(rs),
  }
}
