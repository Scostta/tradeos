import { winRate, totalNetPnl } from "~/lib/calculations/metrics"
import { computeRStats } from "~/lib/calculations/r-multiples"
import type { Trade } from "~/types/trade"
import type { AdherenceGroup, PlaybookAdherence } from "~/types/playbook"
import type { ParsedRules, RuleGroup } from "~/helpers/playbook-rules"

const GROUPS: RuleGroup[] = ["entry", "exit", "conditions"]

/** Did the trade meet every group's minimum for the given rules? */
function meetsSetup(rules: ParsedRules, t: Trade): boolean {
  const followed = t.followedRules ?? []
  return GROUPS.every(g => rules[g].filter(r => followed.includes(r)).length >= rules.min[g])
}

function groupStats(ts: Trade[], riskByAccount: Map<string, number | null>): AdherenceGroup {
  const r = computeRStats(ts, riskByAccount)
  return {
    count:       ts.length,
    winRate:     winRate(ts),
    netPnl:      totalNetPnl(ts),
    expectancyR: r.expectancy,
    rCoverage:   r.coverage,
  }
}

/**
 * Splits a playbook's trades by whether the trader met the setup's per-group
 * minimums (e.g. entry 3 of 6, exit 1 of 2). Untracked trades (no followed-rules
 * record) are excluded. Returns null when there are no rules.
 */
export function computeAdherence(
  rules: ParsedRules,
  trades: Trade[],
  riskByAccount: Map<string, number | null> = new Map(),
): PlaybookAdherence | null {
  if (rules.all.length === 0) return null

  const tracked = trades.filter(t => t.followedRules != null)
  return {
    totalRules: rules.all.length,
    tracked:    tracked.length,
    followed:   groupStats(tracked.filter(t => meetsSetup(rules, t)), riskByAccount),
    broke:      groupStats(tracked.filter(t => !meetsSetup(rules, t)), riskByAccount),
  }
}

/**
 * Portfolio-wide adherence: across every trade whose playbook defines rules,
 * each evaluated against its own playbook's minimums. `totalRules` is reused to
 * carry the count of eligible (playbook-with-rules) trades for the coverage line.
 * Returns null when no eligible trades exist.
 */
export function computePortfolioAdherence(
  rulesById: Map<string, ParsedRules>,
  trades: Trade[],
  riskByAccount: Map<string, number | null> = new Map(),
): PlaybookAdherence | null {
  const eligible = trades.filter(t => {
    const r = t.playbookId ? rulesById.get(t.playbookId) : undefined
    return r != null && r.all.length > 0
  })
  if (eligible.length === 0) return null

  const tracked = eligible.filter(t => t.followedRules != null)
  const isFull  = (t: Trade): boolean => meetsSetup(rulesById.get(t.playbookId!)!, t)

  return {
    totalRules: eligible.length,
    tracked:    tracked.length,
    followed:   groupStats(tracked.filter(isFull), riskByAccount),
    broke:      groupStats(tracked.filter(t => !isFull(t)), riskByAccount),
  }
}
