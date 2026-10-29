import { describe, expect, it } from "vitest"
import { budgetRows, historyMonths, suggestBudget } from "./budgets"
import { monthlySummary } from "./summary"
import type { SummaryCategory, SummaryTransaction } from "./summary"

const categories: (SummaryCategory & { archived?: boolean })[] = [
  { id: "housing", kind: "expense", isFixed: true },
  { id: "groceries", kind: "expense", isFixed: false },
  { id: "subs", kind: "expense", isFixed: true },
  { id: "old", kind: "expense", isFixed: false, archived: true },
  { id: "salary", kind: "income", isFixed: false },
]
const tx = (bookedAt: string, amount: number, categoryId: string | null): SummaryTransaction => ({ bookedAt, amount, categoryId, excluded: false })

describe("suggestBudget", () => {
  it("redondea por arriba a la decena", () => {
    expect(suggestBudget(398)).toBe(400)
    expect(suggestBudget(400)).toBe(400)
    expect(suggestBudget(0)).toBe(0)
    expect(suggestBudget(null)).toBeNull()
  })
})

describe("historyMonths", () => {
  it("cuenta solo los meses anteriores con datos, hasta 3", () => {
    const txs = [tx("2026-08-10", -10, "groceries")]
    expect(historyMonths(txs, "2026-10")).toBe(2)
    expect(historyMonths(txs, "2027-01")).toBe(3)
    expect(historyMonths([], "2026-10")).toBe(0)
  })
})

describe("budgetRows", () => {
  const txs = [
    tx("2026-09-01", -900, "housing"), tx("2026-09-05", -300, "groceries"), tx("2026-09-20", -100, "groceries"),
    tx("2026-10-01", -900, "housing"), tx("2026-10-08", -140, "groceries"), tx("2026-10-15", -70, "groceries"),
    tx("2026-10-16", -30, null), tx("2026-10-02", 2000, "salary"),
  ]

  it("presupuesto, gastado, queda, media y sugerencia; Subscriptions automática; sin categorizar sin presupuesto", () => {
    const summary = monthlySummary(txs, categories, "2026-10")
    const { rows, totals } = budgetRows({
      summary, transactions: txs, categories,
      budgets: new Map([["housing", 900], ["groceries", 150]]),
      auto: { categoryId: "subs", amount: 40 },
    })
    const by = new Map(rows.map(r => [r.categoryId, r]))
    expect(by.get("groceries")).toMatchObject({ budget: 150, spent: 210, left: -60, over: true, avg3: 400, suggested: 400, projected: 210 })
    expect(by.get("housing")).toMatchObject({ budget: 900, spent: 900, left: 0, over: false, isFixed: true })
    expect(by.get("subs")).toMatchObject({ auto: true, budget: 40, spent: 0, suggested: null })
    expect(by.get(null)).toMatchObject({ budget: null, spent: 30, left: null })
    expect(by.has("old")).toBe(false)
    expect(rows[0]!.isFixed).toBe(true)
    expect(totals).toMatchObject({ budget: 1090, spent: 1140, left: -50 })
  })

  it("proyecta el mes en curso: fijas a su importe conocido, variables al ritmo de 14 días", () => {
    const summary = monthlySummary(txs, categories, "2026-10", { today: "2026-10-16" })
    const { rows } = budgetRows({
      summary, transactions: txs, categories, budgets: new Map([["groceries", 250]]), auto: null, today: "2026-10-16",
    })
    const groceries = rows.find(r => r.categoryId === "groceries")!
    // Ventana 03–16 oct: 140 + 70 = 210 en 14 días → 15/día × 15 días que quedan.
    expect(groceries.projected).toBe(210 + 15 * 15)
    expect(groceries.projectedOver).toBe(true)
    expect(rows.find(r => r.categoryId === "housing")!.projected).toBe(900)
  })
})
