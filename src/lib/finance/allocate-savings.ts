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
