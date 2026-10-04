import { GRADE_SCALE } from "~/constants/grades"
import type { GradeScale } from "~/constants/grades"

// Playbook `rules` is stored as JSON (v2):
//   {
//     version: 2,
//     entry:      [{ id, text, required }],
//     exit:       [{ id, text }],
//     conditions: [{ id, text }],
//     min:        { exit, conditions },      // minimum met per group (exit/conditions)
//     gradeMin:   { [gradeId]: n },          // min entry confirmations per grade (all but the lowest)
//   }
// Trades reference criteria by `id` (trades.followed_rules), so editing a
// criterion's text never un-ticks it on past trades.
//
// v1 (string arrays + min.entry) is still parsed — each criterion's id is its
// text, which matches what v1 trades stored — so un-migrated data keeps working.
// Legacy free-text rules parse to empty structured groups.

export type RuleGroup = "entry" | "exit" | "conditions"

export type Criterion      = { id: string; text: string }
export type EntryCriterion = Criterion & { required: boolean }
export type GradeMin       = Record<string, number>

export type PlaybookRules = {
  entry:      EntryCriterion[]
  exit:       Criterion[]
  conditions: Criterion[]
  min:        { exit: number; conditions: number }
  gradeMin:   GradeMin
}

export type ParsedRules = PlaybookRules & {
  all: Criterion[]   // flattened
}

export const EMPTY_RULES: PlaybookRules = {
  entry: [], exit: [], conditions: [],
  min: { exit: 0, conditions: 0 },
  gradeMin: {},
}

const EMPTY: ParsedRules = { ...EMPTY_RULES, all: [] }

const clamp = (n: number, max: number): number => Math.max(0, Math.min(max, Math.round(n)))

/** Entry criteria that aren't required — the ones grade thresholds count. */
export function confirmationCount(entry: EntryCriterion[]): number {
  return entry.filter(c => !c.required).length
}

/**
 * Clamps every threshold to [0, confirmations] and forces them to be
 * non-decreasing as the grade rises. Missing thresholds default to the
 * strictest value (all confirmations).
 */
export function normalizeGradeMin(
  raw: Record<string, unknown>,
  confirmations: number,
  scale: GradeScale = GRADE_SCALE,
): GradeMin {
  const out: GradeMin = {}
  let floor = 0
  for (const g of scale.slice(1)) {
    const v = raw[g.id]
    const n = typeof v === "number" && Number.isFinite(v) ? clamp(v, confirmations) : confirmations
    floor = Math.max(floor, n)
    out[g.id] = floor
  }
  return out
}

/**
 * Sets one grade's threshold and pushes the others so the scale stays
 * non-decreasing: higher grades rise to at least `value`, lower ones drop to
 * at most `value`.
 */
export function setGradeMin(
  gradeMin: GradeMin,
  gradeId: string,
  value: number,
  confirmations: number,
  scale: GradeScale = GRADE_SCALE,
): GradeMin {
  const graded = scale.slice(1)
  const idx = graded.findIndex(g => g.id === gradeId)
  if (idx === -1) return gradeMin
  const v = clamp(value, confirmations)
  const out: GradeMin = {}
  graded.forEach((g, i) => {
    const cur = clamp(gradeMin[g.id] ?? confirmations, confirmations)
    out[g.id] = i < idx ? Math.min(cur, v) : i > idx ? Math.max(cur, v) : v
  })
  return out
}

/**
 * Thresholds for a v1 playbook ("require N of `total`" on entry, no required
 * criteria). Mirrors the SQL migration: the top grade needs every confirmation;
 * the grades below it need N if N < total, else total − 1 (min 1). With no
 * confirmations every threshold is 0.
 */
export function legacyGradeMin(
  total: number,
  n: number,
  scale: GradeScale = GRADE_SCALE,
): GradeMin {
  const out: GradeMin = {}
  const graded = scale.slice(1)
  const lower = total === 0 ? 0 : n < total ? n : Math.max(1, total - 1)
  graded.forEach((g, i) => { out[g.id] = i === graded.length - 1 ? total : lower })
  return normalizeGradeMin(out, total, scale)
}

/**
 * Replaces the entry criteria and clips the grade thresholds to the new number
 * of confirmations (keeping them non-decreasing). Marking a criterion required,
 * or removing a confirmation, lowers that maximum.
 */
export function withEntry(rules: PlaybookRules, entry: EntryCriterion[]): PlaybookRules {
  return { ...rules, entry, gradeMin: normalizeGradeMin(rules.gradeMin, confirmationCount(entry)) }
}

function parseCriterion(v: unknown): Criterion | null {
  if (typeof v === "string") return { id: v, text: v }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    if (typeof o["text"] !== "string") return null
    return { id: typeof o["id"] === "string" ? o["id"] : o["text"], text: o["text"] }
  }
  return null
}

function parseEntry(v: unknown): EntryCriterion | null {
  const c = parseCriterion(v)
  if (!c) return null
  const required = !!v && typeof v === "object" && (v as Record<string, unknown>)["required"] === true
  return { ...c, required }
}

export function parsePlaybookRules(raw: string | null): ParsedRules {
  if (!raw) return EMPTY
  try {
    const p = JSON.parse(raw) as Record<string, unknown>
    if (!p || typeof p !== "object" || Array.isArray(p)) return EMPTY
    const list = <T>(k: RuleGroup, f: (v: unknown) => T | null): T[] =>
      Array.isArray(p[k]) ? (p[k] as unknown[]).map(f).filter((x): x is T => x !== null) : []

    const entry      = list("entry", parseEntry)
    const exit       = list("exit", parseCriterion)
    const conditions = list("conditions", parseCriterion)
    if (!entry.length && !exit.length && !conditions.length) return EMPTY

    const rawMin = (p["min"] ?? {}) as Record<string, unknown>
    const minFor = (g: RuleGroup, len: number): number =>
      typeof rawMin[g] === "number" ? clamp(rawMin[g] as number, len) : len

    const confirmations = confirmationCount(entry)
    const gradeMin = p["gradeMin"] && typeof p["gradeMin"] === "object"
      ? normalizeGradeMin(p["gradeMin"] as Record<string, unknown>, confirmations)
      : legacyGradeMin(confirmations, minFor("entry", entry.length))

    return {
      entry, exit, conditions,
      all: [...entry, ...exit, ...conditions],
      min: { exit: minFor("exit", exit.length), conditions: minFor("conditions", conditions.length) },
      gradeMin,
    }
  } catch { /* not structured JSON */ }
  return EMPTY
}

/** Drops blank criteria and writes the v2 JSON (null when there are no rules). */
export function serializePlaybookRules(r: PlaybookRules): string | null {
  const filled = <T extends Criterion>(xs: T[]): T[] => xs.filter(x => x.text.trim())
  const entry      = filled(r.entry).map(({ id, text, required }) => ({ id, text, required }))
  const exit       = filled(r.exit).map(({ id, text }) => ({ id, text }))
  const conditions = filled(r.conditions).map(({ id, text }) => ({ id, text }))
  if (!entry.length && !exit.length && !conditions.length) return null
  return JSON.stringify({
    version: 2,
    entry, exit, conditions,
    min: {
      exit:       clamp(r.min.exit, exit.length),
      conditions: clamp(r.min.conditions, conditions.length),
    },
    gradeMin: normalizeGradeMin(r.gradeMin, confirmationCount(entry)),
  })
}
