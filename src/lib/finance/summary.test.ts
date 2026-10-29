import { describe, it, expect } from "vitest"
import { monthlySummary, savingsRate } from "./summary"
import type { SummaryCategory, SummaryTransaction } from "./summary"

const categories: SummaryCategory[] = [
  { id: "salary", kind: "income", isFixed: false },
  { id: "housing", kind: "expense", isFixed: true },
  { id: "groceries", kind: "expense", isFixed: false },
  { id: "eating", kind: "expense", isFixed: false },
  { id: "transfer", kind: "transfer", isFixed: false },
  { id: "investing", kind: "savings", isFixed: false },
]

const tx = (bookedAt: string, amount: number, categoryId: string | null, excluded = false): SummaryTransaction =>
  ({ bookedAt, amount, categoryId, excluded })

// Octubre 2026 sintético.
const october: SummaryTransaction[] = [
  tx("2026-10-01", 2500, "salary"),
  tx("2026-10-02", -900, "housing"),
  tx("2026-10-05", -300, "transfer"),           // traspaso a cuenta propia: no cuenta
  tx("2026-10-06", -400, "investing"),          // aportación al indexado: ahorro, no gasto
  tx("2026-10-10", -120, null, true),           // padre de un split: excluido…
  tx("2026-10-10", -80, "groceries"),           // …cuentan sus hijos
  tx("2026-10-10", -40, "eating"),
  tx("2026-10-12", -60, "eating", true),        // excluido (reembolsado): no cuenta
  tx("2026-10-15", -25, null),                  // sin categorizar: gasto variable
  tx("2026-10-16", 30, null),                   // entrada sin categorizar: no es ingreso
]

describe("monthlySummary", () => {
  const s = monthlySummary(october, categories, "2026-10")

  it("ingresos, fijos, variables y ahorro con transferencias, splits y excluidos fuera", () => {
    expect(s).toMatchObject({
      from: "2026-10-01", to: "2026-11-01",
      income: 2500, fixed: 900, variable: 145, spent: 1045,   // 80 + 40 + 25 sin categorizar
      savings: 400, realSavings: 1455,                       // 2500 − 900 − 145
      uncategorizedCount: 2, uncategorizedIn: 30,            // −25 y +30; el padre excluido no cuenta
    })
  })

  it("savingsRate = ahorro real / ingresos; null sin ingresos", () => {
    expect(savingsRate(s)).toBeCloseTo(1455 / 2500)
    expect(savingsRate({ income: 0, realSavings: -100 })).toBeNull()
  })

  it("una línea por categoría (y una para lo sin categorizar), de mayor a menor", () => {
    expect(s.categories.map(l => [l.categoryId, l.kind, l.total])).toEqual([
      ["salary", "income", 2500],
      ["housing", "expense", 900],
      ["investing", "savings", 400],
      ["groceries", "expense", 80],
      ["eating", "expense", 40],
      [null, "expense", 25],
    ])
  })

  it("mes anterior, media de 3 meses con datos y delta", () => {
    const history = [
      tx("2026-08-08", -90, "groceries"),
      tx("2026-09-08", -120, "groceries"),
    ]
    const groceries = monthlySummary([...history, ...october], categories, "2026-10")
      .categories.find(l => l.categoryId === "groceries")!
    // Julio no tiene datos (antes del primer movimiento): media de agosto y septiembre.
    expect(groceries).toMatchObject({ total: 80, previous: 120, avg3: 105, delta: -25 })
    // Sin historia, sin media.
    expect(s.categories.find(l => l.categoryId === "groceries")).toMatchObject({ previous: 0, avg3: null, delta: null })
  })

  it("día de inicio de mes del usuario", () => {
    const shifted = monthlySummary([tx("2026-10-24", -10, "eating"), tx("2026-10-25", -20, "eating")], categories, "2026-11", { startDay: 25 })
    expect(shifted).toMatchObject({ from: "2026-10-25", to: "2026-11-25", variable: 20 })
  })
})

describe("proyección de fin de mes", () => {
  it("variables: gastado + ritmo de 14 días × días restantes; fijos: su importe conocido", () => {
    const txs = [
      tx("2026-09-02", -900, "housing"),       // septiembre: alquiler conocido
      tx("2026-10-03", -70, "groceries"),      // fuera de la ventana de 14 días
      tx("2026-10-08", -140, "groceries"),     // dentro (08–21 oct)
      tx("2026-10-20", -70, "eating"),
    ]
    const s = monthlySummary(txs, categories, "2026-10", { today: "2026-10-21" })
    // 31 días; hoy es el 21 → quedan 10. Ritmo = 210 / 14 = 15 €/día.
    // Variables = 280 + 15 × 10 = 430; fijos = 900 (el alquiler aún no ha pasado).
    expect(s.projection).toEqual({ daysTotal: 31, daysElapsed: 21, daysLeft: 10, spent: 1330 })
  })

  it("sin proyección fuera del mes", () => {
    expect(monthlySummary(october, categories, "2026-10", { today: "2026-11-02" }).projection).toBeNull()
  })
})
