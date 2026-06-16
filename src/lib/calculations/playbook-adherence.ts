import { winRate, totalNetPnl } from "~/lib/calculations/metrics"
import { computeRStats } from "~/lib/calculations/r-multiples"
import type { Trade } from "~/types/trade"
import type { AdherenceGroup, PlaybookAdherence } from "~/types/playbook"
import type { ParsedRules, RuleGroup } from "~/helpers/playbook-rules"

const GROUPS: RuleGroup[] = ["entry", "exit", "conditions"]

/**
 * Splits a playbook's trades by whether the trader met the setup's per-group
 * minimums (e.g. entry 3 of 6, exit 1 of 2). A trade is "followed" when every
 * group has at least `min[group]` of its rules checked. Untracked trades (no
 * followed-rules record) are excluded. Returns null when there are no rules.
 */
export function computeAdherence(
  rules: ParsedRules,
  trades: Trade[],
  riskByAccount: Map<string, number | null> = new Map(),
): PlaybookAdherence | null {
  if (rules.all.length === 0) return null

  const tracked = trades.filter(t => t.followedRules != null)
  const isFull  = (t: Trade): boolean => {
    const followed = t.followedRules ?? []
    return GROUPS.every(g => rules[g].filter(r => followed.includes(r)).length >= rules.min[g])
  }

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
    totalRules: rules.all.length,
    tracked:    tracked.length,
    followed:   group(tracked.filter(isFull)),
    broke:      group(tracked.filter(t => !isFull(t))),
  }
}
