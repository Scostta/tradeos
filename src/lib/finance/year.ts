import { monthOf, monthPeriod } from "./dates"
import type { MonthKey } from "./dates"
import { monthlySummary } from "./summary"
import type { SummaryCategory, SummaryTransaction } from "./summary"

// Resumen del año (MONEY_SPEC.md §5.10): los 12 meses del año con el mismo
// monthlySummary() del Overview, así las cifras cuadran mes a mes. El año son
// los meses que se llaman de ese año (con día de inicio 25, "enero de 2026" va
// del 25/12/2025 al 24/01/2026).

export type YearMonth = {
  month:       MonthKey
  income:      number
  fixed:       number
  variable:    number
  spent:       number
  realSavings: number
  rate:        number | null   // realSavings / income; null sin ingresos
  hasData:     boolean         // algún movimiento en el periodo
  partial:     boolean         // el mes en curso (aún sin cerrar)
}

export type YearCategory = {
  categoryId: string | null    // null = salidas sin categorizar
  isFixed:    boolean
  total:      number
  share:      number           // parte del gasto del año (0–1); 0 si la categoría queda en neto negativo
  byMonth:    number[]         // 12 importes, enero → diciembre
}

export type YearSummary = {
  year:            number
  months:          YearMonth[]  // siempre 12
  monthsWithData:  number
  income:          number
  fixed:           number
  variable:        number
  spent:           number
  savings:         number       // ahorro explícito (categorías savings)
  realSavings:     number
  rate:            number | null
  avgMonthSpent:   number | null   // media de los meses cerrados con datos (el en curso solo si es el único)
  categories:      YearCategory[]  // gasto, de mayor a menor
  uncategorizedCount: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export function yearSummary(
  transactions: SummaryTransaction[],
  categories: SummaryCategory[],
  year: number,
  opts: { startDay?: number; today?: string } = {},
): YearSummary {
  const startDay = opts.startDay ?? 1
  const current = opts.today ? monthOf(opts.today, startDay) : null
  const withData = new Set(transactions.filter(t => !t.excluded).map(t => monthOf(t.bookedAt, startDay)))

  const keys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`)
  const summaries = keys.map(month => monthlySummary(transactions, categories, month, { startDay }))

  const months: YearMonth[] = summaries.map(s => ({
    month:       s.month,
    income:      s.income,
    fixed:       s.fixed,
    variable:    s.variable,
    spent:       s.spent,
    realSavings: s.realSavings,
    rate:        s.income > 0 ? s.realSavings / s.income : null,
    hasData:     withData.has(s.month),
    partial:     s.month === current,
  }))

  const sum = (pick: (m: YearMonth) => number) => round2(months.reduce((a, m) => a + pick(m), 0))
  const income = sum(m => m.income)
  const fixed = sum(m => m.fixed)
  const variable = sum(m => m.variable)
  const spent = round2(fixed + variable)
  const realSavings = sum(m => m.realSavings)

  // Media mensual: un mes a medias la bajaría, así que solo cuenta si no hay otro.
  const closed = months.filter(m => m.hasData && !m.partial)
  const forAvg = closed.length > 0 ? closed : months.filter(m => m.hasData)
  const avgMonthSpent = forAvg.length ? round2(forAvg.reduce((a, m) => a + m.spent, 0) / forAvg.length) : null

  const byCategory = new Map<string, YearCategory>()
  summaries.forEach((s, i) => {
    for (const l of s.categories) {
      if (l.kind !== "expense") continue
      const key = l.categoryId ?? ""
      const row = byCategory.get(key) ?? { categoryId: l.categoryId, isFixed: l.isFixed, total: 0, share: 0, byMonth: Array(12).fill(0) }
      row.byMonth[i] = l.total
      row.total = round2(row.total + l.total)
      byCategory.set(key, row)
    }
  })
  const categoryRows = [...byCategory.values()]
    .filter(r => r.total !== 0)
    .map(r => ({ ...r, share: spent > 0 && r.total > 0 ? r.total / spent : 0 }))
    .sort((a, b) => b.total - a.total)

  return {
    year,
    months,
    monthsWithData: months.filter(m => m.hasData).length,
    income, fixed, variable, spent,
    savings: round2(summaries.reduce((a, s) => a + s.savings, 0)),
    realSavings,
    rate: income > 0 ? realSavings / income : null,
    avgMonthSpent,
    categories: categoryRows,
    uncategorizedCount: summaries.reduce((a, s) => a + s.uncategorizedCount, 0),
  }
}

/** Años con movimientos (y el en curso), del más reciente al más antiguo. */
export function yearsWithData(transactions: Pick<SummaryTransaction, "bookedAt">[], startDay: number, today: string): number[] {
  const years = new Set([Number(monthOf(today, startDay).slice(0, 4))])
  for (const t of transactions) years.add(Number(monthOf(t.bookedAt, startDay).slice(0, 4)))
  return [...years].sort((a, b) => b - a)
}

/** Periodo [from, to) del año entero, para mostrarlo. */
export function yearPeriod(year: number, startDay = 1): { from: string; to: string } {
  return { from: monthPeriod(`${year}-01`, startDay).from, to: monthPeriod(`${year}-12`, startDay).to }
}
