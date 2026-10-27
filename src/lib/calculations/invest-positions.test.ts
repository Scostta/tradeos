import { describe, it, expect } from "vitest"
import { buildPriceIndex } from "./invest-fx"
import {
  closedPositionResult,
  estimatedTaxByClose,
  eurPerUnitAtOrBefore,
  valueOpenPosition,
} from "./invest-positions"
import type { ValuedPosition } from "./invest-positions"

// MU: cierre sin ajustar por encima del ajustado (dividendo posterior).
const index = buildPriceIndex([
  { ticker: "EURUSD=X", monthEnd: "2026-09-30", adjClose: 1.25, close: 1.25 },
  { ticker: "EURUSD=X", monthEnd: "2026-11-30", adjClose: 1.0, close: 1.0 },
  { ticker: "MU", monthEnd: "2026-10-30", adjClose: 1098, close: 1100 },
  { ticker: "MU", monthEnd: "2026-11-30", adjClose: 1197, close: 1200 },
])

const MU: ValuedPosition = {
  id: "p1", ticker: "MU", currency: "USD", openedAt: "2026-10-05", entryPrice: 1000, shares: 4,
  feesOpen: 5, closedAt: null, exitPrice: null, feesClose: 0,
}

describe("eurPerUnitAtOrBefore", () => {
  it("usa el último cierre del par en el mes o antes", () => {
    // Octubre aún sin cierre de EURUSD: vale el de septiembre (1,25).
    expect(eurPerUnitAtOrBefore("USD", "2026-10", index)).toBeCloseTo(0.8, 12)
    expect(eurPerUnitAtOrBefore("USD", "2026-11", index)).toBe(1)
    expect(eurPerUnitAtOrBefore("USD", "2026-08", index)).toBeNull()
    expect(eurPerUnitAtOrBefore("EUR", "2026-01", index)).toBe(1)
    expect(eurPerUnitAtOrBefore(null, "2026-10", index)).toBeNull()
  })
})

describe("valueOpenPosition", () => {
  it("P&L latente = acciones × último cierre REAL − coste real (lo que tendría si vendiera hoy)", () => {
    const v = valueOpenPosition(MU, index)
    expect(v.costEur).toBeCloseTo(4 * 1000 * 0.8, 9)        // 3 200 €
    expect(v.lastMonth).toBe("2026-11")
    expect(v.lastPrice).toBe(1200)                          // close, no el adj (1 197)
    expect(v.valueEur).toBeCloseTo(4 * 1200 * 1.0, 9)      // 4 800 €
    expect(v.pnlEur).toBeCloseTo(1600, 9)
    expect(v.pnlPct).toBeCloseTo(0.5, 12)
  })

  it("filas sin close (anteriores a la columna): sin último precio", () => {
    const old = buildPriceIndex([
      { ticker: "EURUSD=X", monthEnd: "2026-09-30", adjClose: 1.25, close: 1.25 },
      { ticker: "MU", monthEnd: "2026-11-30", adjClose: 1197, close: null },
    ])
    const v = valueOpenPosition(MU, old)
    expect(v.lastPrice).toBeNull()
    expect(v.pnlEur).toBeNull()
  })

  it("sin precios del ticker todavía: valor y P&L null", () => {
    const v = valueOpenPosition({ ...MU, ticker: "NEW" }, index)
    expect(v.costEur).toBeCloseTo(3200, 9)
    expect(v.lastPrice).toBeNull()
    expect(v.pnlEur).toBeNull()
  })
})

describe("closedPositionResult", () => {
  it("P&L bruto y neto de comisiones en EUR", () => {
    const r = closedPositionResult({ ...MU, closedAt: "2026-11-20", exitPrice: 1100, feesClose: 5 }, index)!
    expect(r.costEur).toBeCloseTo(3200, 9)
    expect(r.proceedsEur).toBeCloseTo(4400, 9)
    expect(r.grossPnlEur).toBeCloseTo(1200, 9)
    expect(r.feesEur).toBe(10)
    expect(r.netPnlEur).toBeCloseTo(1190, 9)
  })

  it("abierta o sin FX → null", () => {
    expect(closedPositionResult(MU, index)).toBeNull()
    expect(closedPositionResult({ ...MU, currency: "CHF", closedAt: "2026-11-20", exitPrice: 1 }, index)).toBeNull()
  })
})

describe("estimatedTaxByClose", () => {
  it("cada cierre se lleva lo que añade al impuesto de su año", () => {
    const tax = estimatedTaxByClose([
      { id: "b", closedAt: "2026-06-01", netPnlEur: 5_000 },
      { id: "a", closedAt: "2026-03-01", netPnlEur: 3_000 },    // va primero aunque llegue después
      { id: "c", closedAt: "2026-09-01", netPnlEur: -2_000 },
      { id: "d", closedAt: "2027-02-01", netPnlEur: 1_000 },
    ])
    // a: 3 000 → 19 % = 570
    expect(tax.get("a")).toBe(570)
    // b: año en 8 000 → 6 000 × 19 % + 2 000 × 21 % = 1 560 → añade 990
    expect(tax.get("b")).toBe(990)
    // c: año en 6 000 → 1 140 → devuelve 420
    expect(tax.get("c")).toBe(-420)
    // d: año nuevo, 1 000 → 190
    expect(tax.get("d")).toBe(190)
  })
})
