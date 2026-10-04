import { GRADE_SCALE } from "~/constants/grades"
import type { GradeId, GradeScale } from "~/constants/grades"
import type { EntryCriterion, GradeMin, ParsedRules } from "~/helpers/playbook-rules"
import type { Trade } from "~/types/trade"

/**
 * The single source of a trade's setup grade. Only ENTRY criteria count:
 *   - no checklist recorded (followed === null) or no entry criteria → null (ungraded)
 *   - any required criterion missing → lowest grade ("out of plan")
 *   - otherwise the highest grade whose confirmation threshold is met,
 *     falling back to the lowest grade.
 * Followed ids that aren't entry criteria of this playbook are ignored.
 */
export function computeGrade(
  scale: GradeScale,
  entry: EntryCriterion[],
  gradeMin: GradeMin,
  followed: readonly string[] | null,
): string | null {
  if (followed === null || entry.length === 0 || scale.length === 0) return null

  const lowest = scale[0]!.id
  const ticked = new Set(followed)
  if (entry.some(c => c.required && !ticked.has(c.id))) return lowest

  const met = entry.filter(c => !c.required && ticked.has(c.id)).length
  for (let i = scale.length - 1; i >= 1; i--) {
    const min = gradeMin[scale[i]!.id]
    if (min !== undefined && met >= min) return scale[i]!.id
  }
  return lowest
}

/** Grade of a trade against its playbook's rules, on the app's fixed scale. */
export function gradeForRules(rules: ParsedRules, followed: readonly string[] | null): GradeId | null {
  return computeGrade(GRADE_SCALE, rules.entry, rules.gradeMin, followed) as GradeId | null
}

/** Grade of a trade looked up through its playbook (null without one). */
export function gradeForTrade(
  trade: Pick<Trade, "playbookId" | "followedRules">,
  rulesByPlaybook: ReadonlyMap<string, ParsedRules>,
): GradeId | null {
  const rules = trade.playbookId ? rulesByPlaybook.get(trade.playbookId) : undefined
  return rules ? gradeForRules(rules, trade.followedRules) : null
}

/** Trade-list filter: a grade id, or "none" for ungraded trades. */
export type GradeFilter = GradeId | "none"

export function matchesGradeFilter(grade: GradeId | null, filter: GradeFilter): boolean {
  return filter === "none" ? grade === null : grade === filter
}
