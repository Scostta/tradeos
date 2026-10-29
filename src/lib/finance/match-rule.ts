// Reglas de categorización aprendidas (MONEY_SPEC.md §4.2): "contiene" sobre la
// contraparte normalizada. Gana la prioridad más alta y, a igualdad, el patrón
// más largo (el más específico). Solo categorizan movimientos sin categoría o
// categorizados por una regla: nunca pisan una categoría manual ni un split.

export type Rule = {
  id:         string
  pattern:    string    // ya normalizado (normalizeConcept)
  categoryId: string
  priority:   number
}

export type CategorySource = "rule" | "manual" | "split"

export type RuleTarget = {
  id:             string
  counterparty:   string | null
  categoryId:     string | null
  categorySource: CategorySource | null
  parentId:       string | null
  excluded:       boolean
}

function byPrecedence(a: Rule, b: Rule): number {
  return b.priority - a.priority || b.pattern.length - a.pattern.length
}

export function matchRule(counterparty: string | null, rules: Rule[]): Rule | null {
  if (!counterparty) return null
  return [...rules].sort(byPrecedence).find(r => r.pattern.length > 0 && counterparty.includes(r.pattern)) ?? null
}

export type RuleAssignment = { transactionId: string; categoryId: string; ruleId: string }

/**
 * Qué movimientos categoriza cada regla. Se salta lo manual, los splits (padre
 * excluido e hijos) y lo excluido; lo que ya tiene la categoría correcta por
 * regla no se vuelve a escribir.
 */
export function applyRules(transactions: RuleTarget[], rules: Rule[]): RuleAssignment[] {
  if (rules.length === 0) return []
  const sorted = [...rules].sort(byPrecedence)
  const out: RuleAssignment[] = []
  for (const t of transactions) {
    if (t.excluded || t.parentId != null) continue
    if (t.categorySource === "manual" || t.categorySource === "split") continue
    if (t.categoryId != null && t.categorySource !== "rule") continue
    const rule = t.counterparty ? sorted.find(r => r.pattern.length > 0 && t.counterparty!.includes(r.pattern)) : undefined
    if (rule && rule.categoryId !== t.categoryId) {
      out.push({ transactionId: t.id, categoryId: rule.categoryId, ruleId: rule.id })
    }
  }
  return out
}

/**
 * Movimientos que categoriza hoy cada regla: los de origen "rule" cuya regla
 * ganadora es esa y les puso su categoría. Sirve para contar por regla y para
 * devolver a la cola lo de una regla borrada (sin columna rule_id en la tabla).
 */
export function transactionsByRule(transactions: RuleTarget[], rules: Rule[]): Map<string, string[]> {
  const sorted = [...rules].sort(byPrecedence)
  const out = new Map<string, string[]>()
  for (const t of transactions) {
    if (t.categorySource !== "rule" || !t.counterparty) continue
    const rule = sorted.find(r => r.pattern.length > 0 && t.counterparty!.includes(r.pattern))
    if (!rule || rule.categoryId !== t.categoryId) continue
    out.set(rule.id, [...(out.get(rule.id) ?? []), t.id])
  }
  return out
}
