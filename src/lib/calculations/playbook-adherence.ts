import { winRate, totalNetPnl } from "~/lib/calculations/metrics"
import { computeRStats } from "~/lib/calculations/r-multiples"
import { gradeForRules } from "~/lib/calculations/trade-grade"
import { GRADE_SCALE, LOWEST_GRADE } from "~/constants/grades"
import type { Trade } from "~/types/trade"
import type { AdherenceGroup, GradeGroup, PlaybookAdherence } from "~/types/playbook"
import type { ParsedRules } from "~/helpers/playbook-rules"

/**
 * Did the trade follow the setup? Entry is judged by grade (above the lowest,
 * "out of plan" grade — or no entry criteria at all); exit and conditions keep
 * their per-group minimums.
 */
export function meetsSetup(rules: ParsedRules, t: Trade): boolean {
  const followed = t.followedRules ?? []
  const grade    = gradeForRules(rules, followed)
  if (grade === LOWEST_GRADE) return false
  const ticked = new Set(followed)
  return (["exit", "conditions"] as const).every(
    g => rules[g].filter(c => ticked.has(c.id)).length >= rules.min[g],
  )
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
 * Splits a playbook's trades by whether the trader met the setup (see
 * `meetsSetup`). Untracked trades (no followed-rules record) are excluded.
 * Returns null when there are no rules.
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
 * each evaluated against its own playbook. `totalRules` is reused to carry the
 * count of eligible (playbook-with-rules) trades for the coverage line.
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

/**
 * Trades split by setup grade: one group per grade of the scale, best first,
 * plus a trailing `grade: null` group for ungraded trades.
 */
export function groupByGrade(
  trades: Trade[],
  gradeOf: (t: Trade) => GradeGroup["grade"],
  riskByAccount: Map<string, number | null> = new Map(),
): GradeGroup[] {
  const graded = trades.map(t => ({ t, grade: gradeOf(t) }))
  const pick   = (g: GradeGroup["grade"]): Trade[] => graded.filter(x => x.grade === g).map(x => x.t)
  return [...GRADE_SCALE.map(g => g.id).reverse(), null].map(grade => ({
    grade,
    ...groupStats(pick(grade), riskByAccount),
  }))
}

/** A playbook's trades split by setup grade (see `groupByGrade`). */
export function computeGradeBreakdown(
  rules: ParsedRules,
  trades: Trade[],
  riskByAccount: Map<string, number | null> = new Map(),
): GradeGroup[] {
  return groupByGrade(trades, t => gradeForRules(rules, t.followedRules), riskByAccount)
}
