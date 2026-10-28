// Alta rápida de efectivo (MONEY_SPEC.md §5.7 M2): qué categorías salen como
// chips. Solo gastos sin archivar; primero las más usadas, y si no hay
// bastantes, el resto en su orden.

export type QuickCategory = { id: string; kind: string; archived: boolean; sort: number }

export function quickCategories<T extends QuickCategory>(categories: T[], usage: string[], n = 5): T[] {
  const expense = categories.filter(c => c.kind === "expense" && !c.archived)
  const byId = new Map(expense.map(c => [c.id, c]))
  const used = usage.map(id => byId.get(id)).filter((c): c is T => c != null)
  const rest = expense.filter(c => !usage.includes(c.id)).sort((a, b) => a.sort - b.sort)
  return [...used, ...rest].slice(0, n)
}
