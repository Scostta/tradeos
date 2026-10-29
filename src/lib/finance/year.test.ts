import { describe, it, expect } from "vitest"
import { monthlySummary } from "./summary"
import type { SummaryCategory, SummaryTransaction } from "./summary"
import { yearPeriod, yearSummary, yearsWithData } from "./year"

const categories: SummaryCategory[] = [
  { id: "salary", kind: "income", isFixed: false },
  { id: "housing", kind: "expense", isFixed: true },
  { id: "groceries", kind: "expense", isFixed: false },
  { id: "transfer", kind: "transfer", isFixed: false },
  { id: "investing", kind: "savings", isFixed: false },
]

const tx = (bookedAt: string, amount: number, categoryId: string | null, excluded = false): SummaryTransaction =>
  ({ bookedAt, amount, categoryId, excluded })

// Septiembre y octubre de 2026 cerrados, noviembre en curso, un movimiento de 2025.
const transactions: SummaryTransaction[] = [
  tx("2025-12-10", -50, "groceries"),
  tx("2026-09-01", 2000, "salary"),
  tx("2026-09-02", -800, "housing"),
  tx("2026-09-10", -200, "groceries"),
  tx("2026-09-20", -300, "investing"),
  tx("2026-10-01", 2000, "salary"),
  tx("2026-10-02", -800, "housing"),
  tx("2026-10-10", -400, "groceries"),
  tx("2026-10-11", -100, "transfer"),
  tx("2026-10-12", -60, "groceries", true),
  tx("2026-10-15", -20, null),
  tx("2026-11-03", -100, "groceries"),
]

describe("yearSummary", () => {
  const y = yearSummary(transactions, categories, 2026, { today: "2026-11-05" })

  it("suma los meses del año con el mismo criterio que monthlySummary", () => {
    expect(y).toMatchObject({
      income: 4000, fixed: 1600, variable: 720, spent: 2320,   // 200 + 400 + 20 + 100
      savings: 300, realSavings: 1680, monthsWithData: 3, uncategorizedCount: 1,
    })
    expect(y.rate).toBeCloseTo(0.42)
    const oct = monthlySummary(transactions, categories, "2026-10")
    expect(y.months[9]).toMatchObject({ income: oct.income, spent: oct.spent, realSavings: oct.realSavings, hasData: true, partial: false })
  })

  it("siempre 12 meses; los vacíos sin datos y el en curso marcado", () => {
    expect(y.months).toHaveLength(12)
    expect(y.months[0]).toMatchObject({ month: "2026-01", spent: 0, hasData: false, rate: null })
    expect(y.months[10]).toMatchObject({ month: "2026-11", hasData: true, partial: true })
  })

  it("la media mensual deja fuera el mes en curso", () => {
    expect(y.avgMonthSpent).toBe(1110)   // (1000 + 1220) / 2
  })

  it("gasto por categoría con su parte del año y su serie mensual", () => {
    expect(y.categories.map(c => c.categoryId)).toEqual(["housing", "groceries", null])
    const groceries = y.categories[1]!
    expect(groceries.total).toBe(700)
    expect(groceries.share).toBeCloseTo(700 / 2320)
    expect(groceries.byMonth.slice(8, 11)).toEqual([200, 400, 100])
  })

  it("con día de inicio 25 el año empieza el 25 de diciembre del anterior", () => {
    expect(yearPeriod(2026, 25)).toEqual({ from: "2025-12-25", to: "2026-12-25" })
    const shifted = yearSummary([tx("2025-12-26", -50, "groceries")], categories, 2026, { startDay: 25 })
    expect(shifted.months[0]).toMatchObject({ month: "2026-01", spent: 50, hasData: true })
  })

  it("solo el mes en curso con datos: la media lo usa", () => {
    const only = yearSummary([tx("2026-11-03", -100, "groceries")], categories, 2026, { today: "2026-11-05" })
    expect(only.avgMonthSpent).toBe(100)
  })
})

describe("yearsWithData", () => {
  it("años con movimientos y el en curso, del más reciente al más antiguo", () => {
    expect(yearsWithData(transactions, 1, "2026-11-05")).toEqual([2026, 2025])
    expect(yearsWithData([], 1, "2027-01-02")).toEqual([2027])
  })
})
