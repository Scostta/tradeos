// Playbook `rules` is stored as JSON: { entry?, exit?, conditions? } (string lists).
// Legacy/free-text rules parse to empty structured groups.

export type ParsedRules = {
  entry:      string[]
  exit:       string[]
  conditions: string[]
  all:        string[]   // flattened entry + exit + conditions
}

const EMPTY: ParsedRules = { entry: [], exit: [], conditions: [], all: [] }

export function parsePlaybookRules(raw: string | null): ParsedRules {
  if (!raw) return EMPTY
  try {
    const p = JSON.parse(raw) as Partial<ParsedRules>
    const entry      = Array.isArray(p.entry) ? p.entry : []
    const exit       = Array.isArray(p.exit) ? p.exit : []
    const conditions = Array.isArray(p.conditions) ? p.conditions : []
    if (entry.length || exit.length || conditions.length) {
      return { entry, exit, conditions, all: [...entry, ...exit, ...conditions] }
    }
  } catch { /* not structured JSON */ }
  return EMPTY
}
