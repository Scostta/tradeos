import type { Trade } from "~/types/trade"
import type { EquityPoint, DowBucket, DashboardMetrics } from "~/types/metrics"

export function totalNetPnl(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + t.netPnl, 0)
}

export function winRate(trades: Trade[]): number {
  if (trades.length === 0) return 0
  return trades.filter(t => t.netPnl > 0).length / trades.length
}

export function profitFactor(trades: Trade[]): number {
  const grossWin  = trades.filter(t => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0)
  const grossLoss = Math.abs(trades.filter(t => t.netPnl <= 0).reduce((s, t) => s + t.netPnl, 0))
  if (grossLoss === 0) return grossWin
  return grossWin / grossLoss
}

export function maxDrawdown(trades: Trade[]): number {
  if (trades.length === 0) return 0
  let peak   = 0
  let maxDD  = 0
  let equity = 0
  for (const t of trades) {
    equity += t.netPnl
    if (equity > peak) peak = equity
    const dd = equity - peak
    if (dd < maxDD) maxDD = dd
  }
  return maxDD
}

export function avgWin(trades: Trade[]): number {
  const winners = trades.filter(t => t.netPnl > 0)
  if (winners.length === 0) return 0
  return winners.reduce((s, t) => s + t.netPnl, 0) / winners.length
}

export function avgLoss(trades: Trade[]): number {
  const losers = trades.filter(t => t.netPnl <= 0)
  if (losers.length === 0) return 0
  return losers.reduce((s, t) => s + t.netPnl, 0) / losers.length
}

export function equityCurve(trades: Trade[]): EquityPoint[] {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
  )
  let cumulative = 0
  return sorted.map(t => {
    cumulative += t.netPnl
    return { date: t.entryTime, equity: cumulative, tradeId: t.id }
  })
}

const DOW_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const
type DowKey = typeof DOW_KEYS[number]
const DAY_TO_DOW: Record<number, DowKey> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" }

export function pnlByDayOfWeek(trades: Trade[]): DowBucket[] {
  const map = new Map<DowKey, { net: number; trades: number }>(
    DOW_KEYS.map(k => [k, { net: 0, trades: 0 }])
  )
  for (const t of trades) {
    const day = new Date(t.entryTime).getDay()
    const key = DAY_TO_DOW[day]
    if (key) {
      const bucket = map.get(key)!
      bucket.net    += t.netPnl
      bucket.trades += 1
    }
  }
  return DOW_KEYS.map(k => ({ key: k, ...(map.get(k) ?? { net: 0, trades: 0 }) }))
}

export function computeDashboardMetrics(trades: Trade[]): DashboardMetrics {
  const winners = trades.filter(t => t.netPnl > 0).length
  const totalTrades = trades.length
  return {
    netPnl:       totalNetPnl(trades),
    winRate:      winRate(trades),
    profitFactor: profitFactor(trades),
    maxDrawdown:  maxDrawdown(trades),
    avgWin:       avgWin(trades),
    avgLoss:      avgLoss(trades),
    totalTrades,
    winners,
    losers:       totalTrades - winners,
  }
}
