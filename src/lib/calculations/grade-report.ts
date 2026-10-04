import { GRADE_SCALE } from "~/constants/grades"
import type { GradeId } from "~/constants/grades"
import { zonedParts, zonedYearMonthKey } from "~/helpers/tz"
import { gradeForTrade } from "~/lib/calculations/trade-grade"
import { groupByGrade } from "~/lib/calculations/playbook-adherence"
import type { ParsedRules } from "~/helpers/playbook-rules"
import type { Trade } from "~/types/trade"
import type { GradeMonth, GradeReport } from "~/types/reports"

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const emptyCounts = (): Record<GradeId, number> =>
  Object.fromEntries(GRADE_SCALE.map(g => [g.id, 0])) as Record<GradeId, number>

/**
 * Portfolio-wide setup grades for the Reports "Playbooks" sub-report:
 *   - coverage: how many trades could be / were graded (discipline)
 *   - groups:   win %, net P&L and expectancy (R) per grade
 *   - months:   grade mix per calendar month (user timezone)
 * Every trade is graded against its own playbook through `gradeForTrade`.
 */
export function computeGradeReport(
  rulesByPlaybook: ReadonlyMap<string, ParsedRules>,
  trades: Trade[],
  riskByAccount: Map<string, number | null> = new Map(),
  timeZone = "UTC",
): GradeReport {
  const gradeOf = (t: Trade): GradeId | null => gradeForTrade(t, rulesByPlaybook)
  const gradeable = (t: Trade): boolean => {
    const rules = t.playbookId ? rulesByPlaybook.get(t.playbookId) : undefined
    return rules != null && rules.entry.length > 0
  }

  let noPlaybook = 0, noChecklist = 0, graded = 0
  const byMonth = new Map<string, GradeMonth>()

  for (const t of trades) {
    const grade = gradeOf(t)
    if (!gradeable(t)) noPlaybook++
    else if (grade === null) noChecklist++
    else graded++

    const key = zonedYearMonthKey(t.entryTime, timeZone)
    let m = byMonth.get(key)
    if (!m) {
      const { year, month } = zonedParts(t.entryTime, timeZone)
      m = { key, label: `${SHORT_MONTHS[month - 1]} ${year}`, counts: emptyCounts(), graded: 0, total: 0 }
      byMonth.set(key, m)
    }
    m.total++
    if (grade !== null) { m.counts[grade]++; m.graded++ }
  }

  return {
    coverage: { total: trades.length, noPlaybook, noChecklist, graded },
    groups:   groupByGrade(trades, gradeOf, riskByAccount),
    months:   Array.from(byMonth.values()).sort((a, b) => a.key.localeCompare(b.key)),
  }
}
