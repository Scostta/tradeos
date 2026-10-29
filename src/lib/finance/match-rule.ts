// Reglas de categorización aprendidas (MONEY_SPEC.md §4.2): "contiene" sobre la
// contraparte normalizada y, si la regla lleva importe, además el importe
// absoluto exacto. Gana la regla con importe (la más específica), después la
// prioridad más alta y, a igualdad, el patrón más largo. Solo categorizan
// movimientos sin categoría o categorizados por una regla: nunca pisan una
// categoría manual ni un split.

export type Rule = {
  id:         string
  pattern:    string          // ya normalizado (normalizeConcept)
  amount:     number | null   // importe absoluto exacto; null = cualquiera
  categoryId: string
  priority:   number
}

export type CategorySource = "rule" | "manual" | "split"

export type RuleTarget = {
  id:             string
  counterparty:   string | null
  amount:         number      // firmado
  categoryId:     string | null
  categorySource: CategorySource | null
  parentId:       string | null
  excluded:       boolean
}

function byPrecedence(a: Rule, b: Rule): number {
  return Number(b.amount != null) - Number(a.amount != null) || b.priority - a.priority || b.pattern.length - a.pattern.length
}

const cents = (n: number) => Math.round(Math.abs(n) * 100)

function matches(rule: Rule, counterparty: string, amount: number): boolean {
  return rule.pattern.length > 0 && counterparty.includes(rule.pattern) && (rule.amount == null || cents(rule.amount) === cents(amount))
}

/** Regla ganadora en una lista ya ordenada por precedencia. */
function firstMatch(sorted: Rule[], counterparty: string | null, amount: number): Rule | null {
  if (!counterparty) return null
  return sorted.find(r => matches(r, counterparty, amount)) ?? null
}

export function matchRule(counterparty: string | null, amount: number, rules: Rule[]): Rule | null {
  return firstMatch([...rules].sort(byPrecedence), counterparty, amount)
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
    const rule = firstMatch(sorted, t.counterparty, t.amount)
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
    if (t.categorySource !== "rule") continue
    const rule = firstMatch(sorted, t.counterparty, t.amount)
    if (!rule || rule.categoryId !== t.categoryId) continue
    out.set(rule.id, [...(out.get(rule.id) ?? []), t.id])
  }
  return out
}
