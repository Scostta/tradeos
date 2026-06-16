import { winRate, totalNetPnl, profitFactor, avgWin, avgLoss } from "~/lib/calculations/metrics"
import { computeRStats } from "~/lib/calculations/r-multiples"
import type { Trade } from "~/types/trade"
import type { Playbook, PlaybookWithStats } from "~/types/playbook"

export function computePlaybookStats(
  playbooks: Playbook[],
  trades: Trade[],
  riskByAccount: Map<string, number | null> = new Map(),
): PlaybookWithStats[] {
  const tradesByPlaybook = new Map<string, Trade[]>()

  for (const trade of trades) {
    if (trade.playbookId === null) continue
    const bucket = tradesByPlaybook.get(trade.playbookId) ?? []
    bucket.push(trade)
    tradesByPlaybook.set(trade.playbookId, bucket)
  }

  return playbooks.map((playbook) => {
    const playbookTrades = (tradesByPlaybook.get(playbook.id) ?? [])
      .slice()
      .sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime())

    let cumulative = 0
    const equityCurve = playbookTrades.map(t => (cumulative += t.netPnl))
    const rStats = computeRStats(playbookTrades, riskByAccount)

    return {
      ...playbook,
      tradeCount:   playbookTrades.length,
      winRate:      winRate(playbookTrades),
      netPnl:       totalNetPnl(playbookTrades),
      equityCurve,
      profitFactor: profitFactor(playbookTrades),
      avgWin:       avgWin(playbookTrades),
      avgLoss:      avgLoss(playbookTrades),
      expectancyR:  rStats.expectancy,
      rCoverage:    rStats.coverage,
    }
  })
}
