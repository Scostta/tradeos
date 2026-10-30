// Alta manual (MONEY_SPEC.md §5.7 M2): qué categorías salen como chips y en qué
// cuenta cae el movimiento por defecto.

export type QuickCategory = { id: string; kind: string; archived: boolean; sort: number }
export type ManualDirection = "expense" | "income"

/** Categorías del tipo pedido sin archivar: primero las más usadas, y si no hay bastantes, el resto en su orden. */
export function quickCategories<T extends QuickCategory>(categories: T[], usage: string[], n = 5, kind: ManualDirection = "expense"): T[] {
  const ofKind = categories.filter(c => c.kind === kind && !c.archived)
  const byId = new Map(ofKind.map(c => [c.id, c]))
  const used = usage.map(id => byId.get(id)).filter((c): c is T => c != null)
  const rest = ofKind.filter(c => !usage.includes(c.id)).sort((a, b) => a.sort - b.sort)
  return [...used, ...rest].slice(0, n)
}

export type ManualAccount = { id: string; kind: string; active: boolean }

/**
 * Cuenta preseleccionada: un gasto va a Cash (lo que el banco no ve) y un
 * ingreso a la cuenta por defecto (la nómina llega al banco); si falta, a la
 * primera activa que no sea Cash, y si no hay otra, a Cash.
 */
export function defaultManualAccount<T extends ManualAccount>(accounts: T[], direction: ManualDirection, defaultId: string | null): T | null {
  const active = accounts.filter(a => a.active)
  const cash = active.find(a => a.kind === "cash") ?? null
  if (direction === "expense") return cash ?? active[0] ?? null
  return active.find(a => a.id === defaultId && a.kind !== "cash") ?? active.find(a => a.kind !== "cash") ?? cash
}
