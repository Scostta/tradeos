import { savingsRate } from "~/lib/finance/summary"
import type { FinanceCategory } from "~/types/finance"
import type { OverviewData } from "./overview-data"

// §5.8: lo que se envía a la IA para el resumen del mes. Solo cifras ya
// calculadas por el Overview, redondeadas, en un orden fijo: el hash de esto
// decide si el resumen guardado sigue valiendo.

const r = (n: number | null | undefined): number | null => (n == null ? null : Math.round(n * 100) / 100)

export type SummaryInput = ReturnType<typeof summaryInput>

export function summaryInput(d: OverviewData, categories: FinanceCategory[]) {
  const s = d.summary
  const names = new Map(categories.map(c => [c.id, c.name]))
  const named = (categoryId: string | null) => (categoryId ? names.get(categoryId) : undefined) ?? "Uncategorized"
  const rate = savingsRate(s)
  return {
    month:            d.month,
    isCurrentMonth:   d.isCurrent,
    daysElapsed:      s.projection?.daysElapsed ?? null,
    daysTotal:        s.projection?.daysTotal ?? null,
    income:           r(s.income),
    fixedSpent:       r(s.fixed),
    variableSpent:    r(s.variable),
    totalSpent:       r(s.spent),
    explicitSavings:  r(s.savings),
    realSavings:      r(s.realSavings),
    savingsRatePct:   r(rate == null ? null : rate * 100),
    projectedSpent:   r(d.projectedSpent),
    avg3MonthsSpent:  r(d.avg3Spent),
    spentVsPreviousMonthSameDays: r(d.pace),
    uncategorizedThisMonth: s.uncategorizedCount,
    uncategorizedIncomeThisMonth: r(s.uncategorizedIn),
    uncategorizedQueueAllMonths: d.uncategorized,
    expenseCategories: s.categories
      .filter(l => l.kind === "expense")
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
      .map(l => ({
        name: named(l.categoryId), fixed: l.isFixed,
        total: r(l.total), previousMonth: r(l.previous), avg3Months: r(l.avg3), deltaVsAvg3: r(l.delta),
      })),
    incomeCategories: s.categories
      .filter(l => l.kind === "income")
      .map(l => ({ name: named(l.categoryId), total: r(l.total), avg3Months: r(l.avg3) })),
    subscriptions: {
      active: d.subs.active, monthlyCost: r(d.subs.monthly), yearlyCost: r(d.subs.yearly), unusedCount: d.subs.unused,
    },
    avg6MonthsRealSavings: r(d.avg6Savings),
    lastMonths: d.history.map(h => ({
      month: h.month, income: r(h.income), fixed: r(h.fixed), variable: r(h.variable), realSavings: r(h.realSavings),
    })),
    goals: d.goals.map(g => ({
      name: g.goal.name, saved: r(g.goal.savedAmount), target: r(g.goal.targetAmount), monthlyAllocation: r(g.goal.monthlyAlloc),
    })),
  }
}
