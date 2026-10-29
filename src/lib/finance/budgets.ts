import { addDays, monthOf, monthPeriod, shiftMonth } from "./dates"
import type { MonthKey } from "./dates"
import { expenseTotals } from "./summary"
import type { MonthlySummary, SummaryCategory, SummaryTransaction } from "./summary"

// Presupuestos (MONEY_SPEC.md §5.9). Una fila por categoría de gasto con lo
// presupuestado, lo gastado, lo que queda, la proyección y la sugerencia.

export type BudgetRow = {
  categoryId: string | null     // null = sin categorizar (sin presupuesto)
  isFixed:    boolean
  auto:       boolean           // Subscriptions: presupuesto = suscripciones confirmadas
  budget:     number | null
  spent:      number
  left:       number | null
  projected:  number
  avg3:       number | null
  suggested:  number | null     // media 3 meses redondeada por arriba a la decena
  over:          boolean
  projectedOver: boolean
}

export type BudgetTotals = { budget: number; spent: number; left: number; projected: number; avg3: number | null }

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Media redondeada por arriba a la decena (0 se queda en 0). */
export function suggestBudget(avg3: number | null): number | null {
  return avg3 == null ? null : Math.ceil(avg3 / 10) * 10
}

/** Meses anteriores con datos (hasta 3) en los que se basa la media. */
export function historyMonths(transactions: SummaryTransaction[], month: MonthKey, startDay = 1): number {
  const earliest = transactions.reduce<string | null>((m, t) => (m == null || t.bookedAt < m ? t.bookedAt : m), null)
  if (!earliest) return 0
  const first = monthOf(earliest, startDay)
  return [1, 2, 3].filter(i => shiftMonth(month, -i) >= first).length
}

export function budgetRows(args: {
  summary:      MonthlySummary
  transactions: SummaryTransaction[]
  categories:   (SummaryCategory & { archived?: boolean })[]
  budgets:      Map<string, number>                      // categoryId → importe
  auto:         { categoryId: string; amount: number } | null
  startDay?:    number
  today?:       string                                   // para el ritmo de 14 días del mes en curso
}): { rows: BudgetRow[]; totals: BudgetTotals } {
  const { summary, transactions, categories, budgets, auto, today } = args
  const startDay = args.startDay ?? 1
  const lines = new Map(summary.categories.filter(l => l.kind === "expense").map(l => [l.categoryId, l]))
  const projection = summary.projection
  const recent = projection && today ? expenseTotals(transactions, categories, addDays(today, -13), addDays(today, 1)) : null

  // Media de los meses anteriores con datos (hasta 3), para todas las categorías.
  const n = historyMonths(transactions, summary.month, startDay)
  const past = Array.from({ length: n }, (_, i) => {
    const p = monthPeriod(shiftMonth(summary.month, -(i + 1)), startDay)
    return expenseTotals(transactions, categories, p.from, p.to)
  })
  const avgOf = (id: string | null): number | null => (n ? round2(past.reduce((a, m) => a + (m.get(id) ?? 0), 0) / n) : null)
  const previousOf = (id: string | null): number => past[0]?.get(id) ?? 0

  const ids: (string | null)[] = categories.filter(c => c.kind === "expense" && !c.archived).map(c => c.id)
  if ((lines.get(null)?.total ?? 0) > 0) ids.push(null)

  const rows = ids.map((categoryId): BudgetRow => {
    const line = lines.get(categoryId)
    const isFixed = categoryId ? categories.find(c => c.id === categoryId)?.isFixed ?? false : false
    const isAuto = auto != null && auto.categoryId === categoryId
    const budget = categoryId == null ? null : isAuto ? auto.amount : budgets.get(categoryId) ?? null
    const spent = line?.total ?? 0
    const projected = !projection ? spent
      : isFixed ? Math.max(spent, previousOf(categoryId))
      : spent + ((recent?.get(categoryId) ?? 0) / 14) * projection.daysLeft
    const avg3 = avgOf(categoryId)
    return {
      categoryId, isFixed, auto: isAuto, budget,
      spent: round2(spent),
      left: budget == null ? null : round2(budget - spent),
      projected: round2(projected),
      avg3,
      suggested: categoryId == null || isAuto ? null : suggestBudget(avg3),
      over: budget != null && spent > budget,
      projectedOver: budget != null && projected > budget,
    }
  })
  rows.sort((a, b) => Number(b.isFixed) - Number(a.isFixed)
    || Math.max(b.budget ?? 0, b.spent, b.avg3 ?? 0) - Math.max(a.budget ?? 0, a.spent, a.avg3 ?? 0))

  const sum = (f: (r: BudgetRow) => number) => round2(rows.reduce((a, r) => a + f(r), 0))
  const withAvg = rows.filter(r => r.avg3 != null)
  const budget = sum(r => r.budget ?? 0)
  const spent = sum(r => r.spent)
  return {
    rows,
    totals: {
      budget, spent, left: round2(budget - spent), projected: sum(r => r.projected),
      avg3: withAvg.length ? round2(withAvg.reduce((a, r) => a + r.avg3!, 0)) : null,
    },
  }
}
