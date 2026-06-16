// Playbook `rules` is stored as JSON:
//   { entry?, exit?, conditions?, min?: { entry, exit, conditions } }
// `min` is the minimum criteria that must be met per group for the setup to
// count as valid (e.g. entry 3 of 6, exit 1 of 2). When absent it defaults to
// "all required" (group length), preserving the original strict behaviour.
// Legacy/free-text rules parse to empty structured groups.

export type RuleGroup = "entry" | "exit" | "conditions"

export type ParsedRules = {
  entry:      string[]
  exit:       string[]
  conditions: string[]
  all:        string[]                                    // flattened
  min:        Record<RuleGroup, number>                   // required count per group
}

const EMPTY: ParsedRules = {
  entry: [], exit: [], conditions: [], all: [],
  min: { entry: 0, exit: 0, conditions: 0 },
}

const clamp = (n: number, max: number): number => Math.max(0, Math.min(max, Math.round(n)))

export function parsePlaybookRules(raw: string | null): ParsedRules {
  if (!raw) return EMPTY
  try {
    const p = JSON.parse(raw) as Record<string, unknown>
    const entry      = Array.isArray(p["entry"]) ? (p["entry"] as string[]) : []
    const exit       = Array.isArray(p["exit"]) ? (p["exit"] as string[]) : []
    const conditions = Array.isArray(p["conditions"]) ? (p["conditions"] as string[]) : []
    if (entry.length || exit.length || conditions.length) {
      const rawMin = (p["min"] ?? {}) as Record<string, unknown>
      const minFor = (g: RuleGroup, items: string[]): number =>
        typeof rawMin[g] === "number" ? clamp(rawMin[g] as number, items.length) : items.length
      return {
        entry, exit, conditions,
        all: [...entry, ...exit, ...conditions],
        min: { entry: minFor("entry", entry), exit: minFor("exit", exit), conditions: minFor("conditions", conditions) },
      }
    }
  } catch { /* not structured JSON */ }
  return EMPTY
}
