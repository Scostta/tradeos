import { totalNetPnl, winRate, maxDrawdown } from "~/lib/calculations/metrics"
import type { Trade } from "~/types/trade"
import type { Goals, GoalsProgress } from "~/types/goals"

const round2  = (n: number): number => Math.round(n * 100) / 100
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))
const ratio   = (cur: number, target: number, met: boolean): number => (target > 0 ? clamp01(cur / target) : met ? 1 : 0)

function dateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/**
 * Progress of the current-month trades against the user's monthly goals.
 * Drawdown is a "stay under" limit; the rest are "reach" targets.
 */
export function computeGoalsProgress(goals: Goals, trades: Trade[], monthLabel: string): GoalsProgress {
  const net = round2(totalNetPnl(trades))
  const wr  = winRate(trades)
  const dd  = round2(Math.abs(maxDrawdown(trades)))
  const days = new Set(trades.map(t => dateKey(t.entryTime))).size

  return {
    hasAnyGoal:
      goals.monthlyPnlTarget != null ||
      goals.winRateTarget    != null ||
      goals.maxDrawdownLimit != null ||
      goals.minTradingDays   != null,
    monthLabel,
    pnl: goals.monthlyPnlTarget != null
      ? { target: goals.monthlyPnlTarget, current: net, pct: ratio(net, goals.monthlyPnlTarget, net >= goals.monthlyPnlTarget), met: net >= goals.monthlyPnlTarget }
      : null,
    winRate: goals.winRateTarget != null
      ? { target: goals.winRateTarget, current: wr, pct: ratio(wr, goals.winRateTarget, wr >= goals.winRateTarget), met: wr >= goals.winRateTarget }
      : null,
    drawdown: goals.maxDrawdownLimit != null
      ? { limit: goals.maxDrawdownLimit, current: dd, pct: ratio(dd, goals.maxDrawdownLimit, false), breached: dd > goals.maxDrawdownLimit }
      : null,
    tradingDays: goals.minTradingDays != null
      ? { target: goals.minTradingDays, current: days, pct: ratio(days, goals.minTradingDays, days >= goals.minTradingDays), met: days >= goals.minTradingDays }
      : null,
  }
}
