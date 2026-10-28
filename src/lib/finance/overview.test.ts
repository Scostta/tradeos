import { describe, it, expect } from "vitest"
import { paceVsPreviousMonth } from "./overview"
import type { SummaryCategory, SummaryTransaction } from "./summary"

const categories: SummaryCategory[] = [
  { id: "food", kind: "expense", isFixed: false },
  { id: "salary", kind: "income", isFixed: false },
]
const tx = (bookedAt: string, amount: number, categoryId = "food"): SummaryTransaction =>
  ({ bookedAt, amount, categoryId, excluded: false })

describe("paceVsPreviousMonth", () => {
  const txs = [
    tx("2026-09-05", -100), tx("2026-09-12", -50), tx("2026-09-25", -300),   // septiembre
    tx("2026-10-03", -40), tx("2026-10-11", -30), tx("2026-10-20", -500),    // octubre
    tx("2026-10-01", 2000, "salary"),                                         // los ingresos no cuentan
  ]

  it("gastado hasta hoy menos lo gastado el mes anterior en los mismos días", () => {
    // Hasta el 12: octubre 70, septiembre 150 → 80 por debajo.
    expect(paceVsPreviousMonth(txs, categories, "2026-10", "2026-10-12")).toBe(-80)
    // Hasta el 25: octubre 570, septiembre 450 → 120 por encima.
    expect(paceVsPreviousMonth(txs, categories, "2026-10", "2026-10-25")).toBe(120)
  })

  it("null sin mes anterior o si hoy no cae en el mes", () => {
    expect(paceVsPreviousMonth(txs.filter(t => t.bookedAt >= "2026-10"), categories, "2026-10", "2026-10-12")).toBeNull()
    expect(paceVsPreviousMonth(txs, categories, "2026-09", "2026-10-12")).toBeNull()
  })
})
