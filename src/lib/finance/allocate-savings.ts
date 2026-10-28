import { daysBetween, monthOf, shiftMonth } from "./dates"
import type { MonthKey } from "./dates"

// Objetivos de ahorro (MONEY_SPEC.md §4.5). No mueven dinero: reparten sobre
// el papel el ahorro real del mes cerrado. Prioridad 1 = primero en recibir y
// último en recortar; si el ahorro no llega, se queda sin nada antes el de
// número más alto.

export type GoalInput = {
  id:           string
  targetAmount: number
  savedAmount:  number
  monthlyAlloc: number
  priority:     number
  deadline:     string | null
  status:       "active" | "completed" | "archived"
}

export type Allocation = {
  goalId:    string
  wanted:    number    // lo que pide: su aportación mensual, sin pasarse de lo que falta
  allocated: number
  completes: boolean   // con esto llega al objetivo
}

export type AllocationResult = {
  allocations: Allocation[]   // en orden de prioridad
  unallocated: number         // sobrante sin asignar
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export function allocateSavings(goals: GoalInput[], realSavings: number): AllocationResult {
  const active = goals
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.status === "active")
    .sort((a, b) => a.g.priority - b.g.priority || a.i - b.i)

  let available = Math.max(0, round2(realSavings))
  const allocations = active.map(({ g }) => {
    const remaining = Math.max(0, round2(g.targetAmount - g.savedAmount))
    const wanted = round2(Math.min(g.monthlyAlloc, remaining))
    const allocated = round2(Math.min(wanted, available))
    available = round2(available - allocated)
    return { goalId: g.id, wanted, allocated, completes: remaining > 0 && allocated >= remaining }
  })
  return { allocations, unallocated: available }
}

export type ClosableGoal = GoalInput & { createdMonth: MonthKey }

export type CloseResult = {
  closed:  MonthKey[]                                             // meses cerrados, en orden
  goals:   { id: string; savedAmount: number; completed: boolean }[]   // solo los que cambian
}

/**
 * Cierra los meses `from`…`to` (incluidos) en orden: el ahorro real de cada mes
 * se reparte con allocateSavings entre los objetivos activos que ya existían
 * ese mes, y suma a su saved_amount. Un objetivo que llega a su meta pasa a
 * completado y deja de recibir.
 */
export function closeMonths(
  goals: ClosableGoal[],
  realSavingsByMonth: Map<MonthKey, number>,
  from: MonthKey,
  to: MonthKey,
): CloseResult {
  const state = new Map(goals.map(g => [g.id, { ...g }]))
  const changed = new Set<string>()
  const closed: MonthKey[] = []
  for (let m = from; m <= to; m = shiftMonth(m, 1)) {
    const eligible = [...state.values()].filter(g => g.status === "active" && g.createdMonth <= m)
    const { allocations } = allocateSavings(eligible, realSavingsByMonth.get(m) ?? 0)
    for (const a of allocations) {
      if (a.allocated <= 0) continue
      const g = state.get(a.goalId)!
      g.savedAmount = round2(g.savedAmount + a.allocated)
      if (g.savedAmount >= g.targetAmount) g.status = "completed"
      changed.add(g.id)
    }
    closed.push(m)
  }
  return {
    closed,
    goals: [...changed].map(id => {
      const g = state.get(id)!
      return { id, savedAmount: g.savedAmount, completed: g.status === "completed" }
    }),
  }
}

/** Primer mes que aún aportará a los objetivos: el actual, o el siguiente al último cerrado si ya se cerró. */
export function firstOpenMonth(current: MonthKey, closedThrough: MonthKey | null): MonthKey {
  return closedThrough != null && closedThrough >= current ? shiftMonth(closedThrough, 1) : current
}

export type GoalEta = {
  month: MonthKey | null   // mes estimado de completar; null si no tiene aportación
  tight: boolean           // la fecha límite llega antes que la estimada
}

/** Mes en que se completa a su aportación mensual, contando desde `fromMonth` (el primero que aporta). */
export function goalEta(goal: GoalInput, fromMonth: MonthKey): GoalEta {
  const remaining = round2(goal.targetAmount - goal.savedAmount)
  if (remaining <= 0) return { month: shiftMonth(fromMonth, -1), tight: false }
  if (goal.monthlyAlloc <= 0) return { month: null, tight: goal.deadline != null }
  const months = Math.ceil(remaining / goal.monthlyAlloc)
  const month = shiftMonth(fromMonth, months - 1)
  return { month, tight: goal.deadline != null && monthOf(goal.deadline) < month }
}

/** Aportación mensual necesaria para llegar a la fecha límite (incluido su mes); null sin fecha. */
export function requiredMonthly(goal: Pick<GoalInput, "targetAmount" | "savedAmount" | "deadline">, fromMonth: MonthKey): number | null {
  if (!goal.deadline) return null
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount)
  const months = monthsInclusive(fromMonth, monthOf(goal.deadline))
  return months <= 0 ? null : round2(remaining / months)
}

function monthsInclusive(from: MonthKey, to: MonthKey): number {
  return Math.round(daysBetween(`${from}-15`, `${to}-15`) / 30.44) + 1
}
