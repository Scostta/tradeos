import { addDays, daysBetween, monthOf, monthPeriod, shiftMonth } from "./dates"
import type { MonthKey } from "./dates"

// Resumen de un mes (MONEY_SPEC.md §4.4). El `kind` de la categoría decide:
//   income   → ingresos                expense → gasto (fijo o variable por is_fixed)
//   savings  → ahorro explícito (una aportación al indexado no es gasto)
//   transfer → fuera                   excluded → fuera (el padre de un split
//                                                  también: cuentan sus hijos)
// Sin categoría (decisión de implementación, ver MONEY_SPEC.md §4.4): las
// salidas cuentan como gasto variable y las entradas no cuentan como ingreso,
// para que el ahorro real nunca salga inflado mientras quede cola.

export type CategoryKind = "expense" | "income" | "transfer" | "savings"

export type SummaryTransaction = {
  bookedAt:   string
  amount:     number          // firmado: negativo = sale
  categoryId: string | null
  excluded:   boolean
}

export type SummaryCategory = {
  id:      string
  kind:    CategoryKind
  isFixed: boolean
}

export type CategoryLine = {
  categoryId: string | null   // null = sin categorizar (salidas)
  kind:       "expense" | "income" | "savings"
  isFixed:    boolean
  total:      number          // en positivo: lo gastado / ingresado / ahorrado
  previous:   number
  avg3:       number | null   // media de los 3 meses anteriores con datos; null si no hay
  delta:      number | null   // total − avg3
}

export type Projection = {
  daysTotal:   number
  daysElapsed: number         // incluido hoy
  daysLeft:    number
  spent:       number         // gasto proyectado a fin de mes (fijos + variables)
}

export type MonthlySummary = {
  month:              MonthKey
  from:               string
  to:                 string  // exclusivo
  income:             number
  fixed:              number
  variable:           number  // incluye las salidas sin categorizar
  spent:              number  // fixed + variable
  savings:            number  // ahorro explícito (categorías savings)
  realSavings:        number  // income − fixed − variable
  uncategorizedCount: number
  uncategorizedIn:    number  // entradas sin categoría (no cuentan como ingreso)
  categories:         CategoryLine[]
  projection:         Projection | null   // solo si `today` cae dentro del mes
}

const round2 = (n: number): number => Math.round(n * 100) / 100

type Bucket = Map<string, number>   // clave de línea → total en positivo

function lineKey(categoryId: string | null, kind: CategoryLine["kind"]): string {
  return `${kind}:${categoryId ?? ""}`
}

function totalsFor(transactions: SummaryTransaction[], categories: Map<string, SummaryCategory>, from: string, to: string) {
  const bucket: Bucket = new Map()
  let uncategorizedCount = 0
  let uncategorizedIn = 0
  for (const t of transactions) {
    if (t.excluded || t.bookedAt < from || t.bookedAt >= to) continue
    const category = t.categoryId ? categories.get(t.categoryId) : undefined
    if (!category) {
      uncategorizedCount++
      if (t.amount < 0) bucket.set(lineKey(null, "expense"), (bucket.get(lineKey(null, "expense")) ?? 0) - t.amount)
      else uncategorizedIn += t.amount
      continue
    }
    if (category.kind === "transfer") continue
    const sign = category.kind === "income" ? 1 : -1
    const key = lineKey(category.id, category.kind)
    bucket.set(key, (bucket.get(key) ?? 0) + sign * t.amount)
  }
  return { bucket, uncategorizedCount, uncategorizedIn }
}

export function monthlySummary(
  transactions: SummaryTransaction[],
  categoryList: SummaryCategory[],
  month: MonthKey,
  opts: { startDay?: number; today?: string } = {},
): MonthlySummary {
  const startDay = opts.startDay ?? 1
  const categories = new Map(categoryList.map(c => [c.id, c]))
  const { from, to } = monthPeriod(month, startDay)
  const current = totalsFor(transactions, categories, from, to)

  // Meses anteriores para "previous" y la media de 3: solo los que tienen datos
  // (antes del primer movimiento no hay historia, no son ceros).
  const earliest = transactions.reduce<string | null>((min, t) => (min == null || t.bookedAt < min ? t.bookedAt : min), null)
  const firstMonth = earliest ? monthOf(earliest, startDay) : month
  const history = [1, 2, 3]
    .map(i => shiftMonth(month, -i))
    .filter(m => m >= firstMonth)
    .map(m => {
      const p = monthPeriod(m, startDay)
      return totalsFor(transactions, categories, p.from, p.to).bucket
    })

  const keys = new Set([...current.bucket.keys(), ...(history[0]?.keys() ?? [])])
  const lines: CategoryLine[] = [...keys].map(key => {
    const [kind, id] = key.split(":") as [CategoryLine["kind"], string]
    const categoryId = id || null
    const total = round2(current.bucket.get(key) ?? 0)
    const avg3 = history.length ? round2(history.reduce((a, b) => a + (b.get(key) ?? 0), 0) / history.length) : null
    return {
      categoryId,
      kind,
      isFixed: categoryId ? categories.get(categoryId)?.isFixed ?? false : false,
      total,
      previous: round2(history[0]?.get(key) ?? 0),
      avg3,
      delta: avg3 == null ? null : round2(total - avg3),
    }
  }).sort((a, b) => b.total - a.total)

  const sum = (pred: (l: CategoryLine) => boolean) => round2(lines.filter(pred).reduce((a, l) => a + l.total, 0))
  const income = sum(l => l.kind === "income")
  const fixed = sum(l => l.kind === "expense" && l.isFixed)
  const variable = sum(l => l.kind === "expense" && !l.isFixed)
  const savings = sum(l => l.kind === "savings")

  return {
    month, from, to,
    income, fixed, variable,
    spent: round2(fixed + variable),
    savings,
    realSavings: round2(income - fixed - variable),
    uncategorizedCount: current.uncategorizedCount,
    uncategorizedIn: round2(current.uncategorizedIn),
    categories: lines,
    projection: opts.today && opts.today >= from && opts.today < to
      ? project(transactions, categories, lines, { from, to, today: opts.today })
      : null,
  }
}

/**
 * Proyección de fin de mes: variables = gastado + ritmo diario de los últimos
 * 14 días × días que quedan; fijos = su importe conocido (el mayor entre lo
 * cargado este mes y el mes anterior, por categoría).
 */
function project(
  transactions: SummaryTransaction[],
  categories: Map<string, SummaryCategory>,
  lines: CategoryLine[],
  { from, to, today }: { from: string; to: string; today: string },
): Projection {
  const daysTotal = daysBetween(from, to)
  const daysElapsed = daysBetween(from, today) + 1
  const daysLeft = daysTotal - daysElapsed

  const windowFrom = addDays(today, -13)
  const windowTo = addDays(today, 1)
  const recent = totalsFor(transactions, categories, windowFrom, windowTo).bucket
  let recentVariable = 0
  for (const [key, value] of recent) {
    const [kind, id] = key.split(":")
    if (kind === "expense" && !(id && categories.get(id)?.isFixed)) recentVariable += value
  }
  const variableSoFar = lines.filter(l => l.kind === "expense" && !l.isFixed).reduce((a, l) => a + l.total, 0)
  const fixedKnown = lines.filter(l => l.kind === "expense" && l.isFixed).reduce((a, l) => a + Math.max(l.total, l.previous), 0)

  return {
    daysTotal,
    daysElapsed,
    daysLeft,
    spent: round2(fixedKnown + variableSoFar + (recentVariable / 14) * daysLeft),
  }
}

/** Tasa de ahorro = ahorro real / ingresos; null sin ingresos. */
export function savingsRate(summary: Pick<MonthlySummary, "income" | "realSavings">): number | null {
  return summary.income > 0 ? summary.realSavings / summary.income : null
}
