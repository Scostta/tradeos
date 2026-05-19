import { winRate, totalNetPnl } from "~/lib/calculations/metrics"
import type { Trade } from "~/types/trade"
import type { Strategy, StrategyWithStats } from "~/types/strategy"

export function computeStrategyStats(
  strategies: Strategy[],
  trades: Trade[],
): StrategyWithStats[] {
  const tradesByStrategy = new Map<string, Trade[]>()

  for (const trade of trades) {
    if (trade.strategyId === null) continue
    const bucket = tradesByStrategy.get(trade.strategyId) ?? []
    bucket.push(trade)
    tradesByStrategy.set(trade.strategyId, bucket)
  }

  return strategies.map((strategy) => {
    const strategyTrades = (tradesByStrategy.get(strategy.id) ?? [])
      .slice()
      .sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime())

    let cumulative = 0
    const equityCurve = strategyTrades.map(t => (cumulative += t.netPnl))

    return {
      ...strategy,
      tradeCount:  strategyTrades.length,
      winRate:     winRate(strategyTrades),
      netPnl:      totalNetPnl(strategyTrades),
      equityCurve,
    }
  })
}
