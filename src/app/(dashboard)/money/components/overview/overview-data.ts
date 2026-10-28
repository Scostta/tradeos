import { daysBetween, monthOf, shiftMonth } from "~/lib/finance/dates"
import type { MonthKey } from "~/lib/finance/dates"
import { goalEta } from "~/lib/finance/allocate-savings"
import { paceVsPreviousMonth } from "~/lib/finance/overview"
import { daysToNext, monthlyCost, yearlyCost } from "~/lib/finance/subscriptions"
import { monthlySummary } from "~/lib/finance/summary"
import type { CategoryLine, MonthlySummary } from "~/lib/finance/summary"
import type { FinanceCategory, FinanceGoal, FinanceSubscription, FinanceTransaction } from "~/types/finance"

// Datos del Overview (MONEY_SPEC.md §5.1), calculados en el servidor a partir
// de los movimientos: nada se declara dos veces.

export type OverviewData = {
  month:          MonthKey
  isCurrent:      boolean
  summary:        MonthlySummary
  avg3Spent:      number | null          // referencia mientras no hay presupuestos (v2)
  left:           number | null          // avg3Spent − gastado
  projectedSpent: number | null
  pace:           number | null          // vs. mes anterior en los mismos días
  overAvg:        { category: FinanceCategory; delta: number } | null
  uncategorized:  number                 // cola (todos los meses)
  categoryLines:  (CategoryLine & { category: FinanceCategory | null })[]   // gastos
  subs:           { active: number; monthly: number; yearly: number; unused: number }
  renewals:       { sub: FinanceSubscription; days: number }[]
  avg6Savings:    number | null
  history:        FlowMonth[]            // hasta 6 meses con datos, el seleccionado el último
  goals:          { goal: FinanceGoal; eta: MonthKey | null }[]
  lastImportDays: number | null
}

export type FlowMonth = {
  month:       MonthKey
  income:      number
  fixed:       number
  variable:    number
  realSavings: number
}

const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function buildOverview(args: {
  transactions:  FinanceTransaction[]
  categories:    FinanceCategory[]
  subscriptions: FinanceSubscription[]
  goals:         FinanceGoal[]
  month:         MonthKey
  today:         string
  startDay:      number
}): OverviewData {
  const { transactions, categories, subscriptions, goals, month, today, startDay } = args
  const isCurrent = monthOf(today, startDay) === month
  const summary = monthlySummary(transactions, categories, month, { startDay, today: isCurrent ? today : undefined })

  // Meses anteriores con datos (antes del primer movimiento no hay historia).
  const firstMonth = transactions.reduce<string | null>((m, t) => (m == null || t.bookedAt < m ? t.bookedAt : m), null)
  const first = firstMonth ? monthOf(firstMonth, startDay) : month
  const previous = (n: number) => Array.from({ length: n }, (_, i) => shiftMonth(month, -(i + 1)))
    .filter(m => m >= first)
    .map(m => monthlySummary(transactions, categories, m, { startDay }))

  const avg3Spent = avg(previous(3).map(s => s.spent))
  const byId = new Map(categories.map(c => [c.id, c]))

  const over = summary.categories
    // Una media ≤ 0 (p. ej. Bizum con más recibido que enviado) no es referencia.
    .filter(l => l.kind === "expense" && l.categoryId && l.avg3 != null && l.avg3 > 0 && l.delta != null && l.delta >= 5)
    .sort((a, b) => b.delta! - a.delta!)[0]

  const confirmed = subscriptions.filter(s => s.status === "confirmed")
  const lastImport = transactions
    .filter(t => t.source === "import")
    .reduce<string | null>((m, t) => (m == null || t.createdAt > m ? t.createdAt : m), null)

  return {
    month,
    isCurrent,
    summary,
    avg3Spent,
    left: avg3Spent == null ? null : Math.round((avg3Spent - summary.spent) * 100) / 100,
    projectedSpent: summary.projection?.spent ?? null,
    pace: isCurrent ? paceVsPreviousMonth(transactions, categories, month, today, startDay) : null,
    overAvg: over ? { category: byId.get(over.categoryId!)!, delta: over.delta! } : null,
    uncategorized: transactions.filter(t => t.categoryId == null && t.parentId == null && !t.excluded).length,
    categoryLines: summary.categories
      .filter(l => l.kind === "expense")
      .map(l => ({ ...l, category: l.categoryId ? byId.get(l.categoryId) ?? null : null })),
    subs: {
      active:  confirmed.length,
      monthly: confirmed.reduce((a, s) => a + monthlyCost(s), 0),
      yearly:  confirmed.reduce((a, s) => a + yearlyCost(s), 0),
      unused:  confirmed.filter(s => s.usage === "unused").length,
    },
    renewals: confirmed
      .map(sub => ({ sub, days: daysToNext(sub, today) }))
      .filter((r): r is { sub: FinanceSubscription; days: number } => r.days != null && r.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4),
    avg6Savings: avg(previous(6).map(s => s.realSavings)),
    history: [...previous(5).reverse(), summary].map(s => ({
      month: s.month, income: s.income, fixed: s.fixed, variable: s.variable, realSavings: s.realSavings,
    })),
    goals: goals
      .filter(g => g.status === "active")
      .map(goal => ({ goal, eta: goalEta(goal, shiftMonth(month, 1)).month })),
    lastImportDays: lastImport ? daysBetween(lastImport.slice(0, 10), today) : null,
  }
}
