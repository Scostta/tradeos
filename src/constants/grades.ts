// Setup grade scale, ordered worst → best. The first grade is always the
// "out of plan" floor and has no threshold; every other grade needs a minimum
// number of entry confirmations (configured per playbook in `gradeMin`).
// Thresholds are keyed by `id`, never by label, so relabelling is safe.

export type GradeDef = {
  id:    string
  label: string
  color: string
}

export type GradeScale = readonly GradeDef[]

export const GRADE_SCALE = [
  { id: "d", label: "D", color: "var(--color-loss)"   },
  { id: "b", label: "B", color: "var(--color-long)"   },
  { id: "a", label: "A", color: "var(--color-profit)" },
] as const satisfies GradeScale

export type GradeId = (typeof GRADE_SCALE)[number]["id"]

export const LOWEST_GRADE: GradeId = GRADE_SCALE[0].id

export function isGradeId(v: unknown): v is GradeId {
  return GRADE_SCALE.some(g => g.id === v)
}

export function gradeDef(id: GradeId): GradeDef {
  return GRADE_SCALE.find(g => g.id === id)!
}
