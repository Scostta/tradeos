import { describe, it, expect } from "vitest"
import { suggestedPositionSize } from "./invest-sizing"
import { buildPriceIndex, eurPerUnit, monthRange, shiftMonth } from "./invest-fx"

const SETTINGS = { totalPortfolioValue: 100_000, positionPct: 0.04 }

describe("suggestedPositionSize", () => {
  it("4 % del patrimonio y acciones redondeadas hacia abajo", () => {
    expect(suggestedPositionSize(SETTINGS, 300)).toEqual({ amount: 4_000, shares: 13 })
    expect(suggestedPositionSize(SETTINGS, 100)).toEqual({ amount: 4_000, shares: 40 })
    expect(suggestedPositionSize(SETTINGS, 0.1)).toEqual({ amount: 4_000, shares: 40_000 })
  })

  it("pasa el precio a EUR antes de dividir", () => {
    // 110 USD con EURUSD 1,10 → 100 € → 40 acciones.
    expect(suggestedPositionSize(SETTINGS, 110, 1 / 1.1).shares).toBe(40)
  })

  it("precio no positivo → 0 acciones", () => {
    expect(suggestedPositionSize(SETTINGS, 0).shares).toBe(0)
  })
})

describe("eurPerUnit", () => {
  const index = buildPriceIndex([
    { ticker: "EURUSD=X", monthEnd: "2026-09-30", adjClose: 1.25 },
    { ticker: "EURGBP=X", monthEnd: "2026-09-30", adjClose: 0.8 },
  ])

  it("EUR es 1; USD divide por EURUSD; GBp además entre 100", () => {
    expect(eurPerUnit("EUR", "2026-09", index)).toBe(1)
    expect(eurPerUnit("USD", "2026-09", index)).toBeCloseTo(0.8, 12)
    expect(eurPerUnit("GBp", "2026-09", index)).toBeCloseTo(0.0125, 12)
    expect(eurPerUnit("GBP", "2026-09", index)).toBeCloseTo(1.25, 12)
  })

  it("null si falta el par, el mes o la divisa", () => {
    expect(eurPerUnit("CHF", "2026-09", index)).toBeNull()
    expect(eurPerUnit("USD", "2026-08", index)).toBeNull()
    expect(eurPerUnit("ZAc", "2026-09", index)).toBeNull()
    expect(eurPerUnit(null, "2026-09", index)).toBeNull()
  })
})

describe("meses", () => {
  it("shiftMonth cruza años", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
    expect(shiftMonth("2025-12", 1)).toBe("2026-01")
    expect(shiftMonth("2026-03", -14)).toBe("2025-01")
  })

  it("monthRange incluye ambos extremos", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"])
    expect(monthRange("2026-02", "2026-01")).toEqual([])
  })
})
