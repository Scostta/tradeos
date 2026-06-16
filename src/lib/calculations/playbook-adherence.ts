import { winRate, totalNetPnl } from "~/lib/calculations/metrics"
import { computeRStats } from "~/lib/calculations/r-multiples"
import type { Trade } from "~/types/trade"
import type { AdherenceGroup, PlaybookAdherence } from "~/types/playbook"

/**
 * Splits a playbook's trades by whether the trader followed the full setup.
 * A trade counts as "followed" when its followed_rules cover every current
 * rule. Trades without a followed-rules record are untracked (excluded).
 * Returns null when the playbook has no structured rules.
 */
export function computeAdherence(
  ruleList: string[],
  trades: Trade[],
  riskByAccount: Map<string, number | null> = new Map(),
): PlaybookAdherence | null {
  if (ruleList.length === 0) return null

  const tracked = trades.filter(t => t.followedRules != null)
  const isFull  = (t: Trade): boolean => ruleList.every(r => (t.followedRules ?? []).includes(r))

  const group = (ts: Trade[]): AdherenceGroup => {
    const r = computeRStats(ts, riskByAccount)
    return {
      count:       ts.length,
      winRate:     winRate(ts),
      netPnl:      totalNetPnl(ts),
      expectancyR: r.expectancy,
      rCoverage:   r.coverage,
    }
  }

  return {
    totalRules: ruleList.length,
    tracked:    tracked.length,
    followed:   group(tracked.filter(isFull)),
    broke:      group(tracked.filter(t => !isFull(t))),
  }
}
