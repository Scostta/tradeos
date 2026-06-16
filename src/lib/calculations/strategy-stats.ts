import { winRate, totalNetPnl, profitFactor, avgWin, avgLoss } from "~/lib/calculations/metrics"
import { computeRStats } from "~/lib/calculations/r-multiples"
import type { Trade } from "~/types/trade"
import type { Strategy, StrategyWithStats } from "~/types/strategy"

export function computeStrategyStats(
  strategies: Strategy[],
  trades: Trade[],
  riskByAccount: Map<string, number | null> = new Map(),
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
    const rStats = computeRStats(strategyTrades, riskByAccount)

    return {
      ...strategy,
      tradeCount:   strategyTrades.length,
      winRate:      winRate(strategyTrades),
      netPnl:       totalNetPnl(strategyTrades),
      equityCurve,
      profitFactor: profitFactor(strategyTrades),
      avgWin:       avgWin(strategyTrades),
      avgLoss:      avgLoss(strategyTrades),
      expectancyR:  rStats.expectancy,
      rCoverage:    rStats.coverage,
    }
  })
}
