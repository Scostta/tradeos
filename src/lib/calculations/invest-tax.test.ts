import { describe, it, expect } from "vitest"
import { estimateSpanishCapitalGainsTax, spanishSavingsTax } from "./invest-tax"

describe("spanishSavingsTax", () => {
  it.each([
    [0, 0],
    [-5_000, 0],
    [1_000, 190],
    [6_000, 1_140],
    // 6 000 × 19 % + 4 000 × 21 %
    [10_000, 1_140 + 840],
    [50_000, 1_140 + 9_240],
    // + 50 000 × 23 %
    [100_000, 10_380 + 11_500],
    [200_000, 10_380 + 34_500],
    // + 50 000 × 27 %
    [250_000, 44_880 + 13_500],
    // + 27 000 (tramo 27 % entero) + 100 000 × 28 %
    [400_000, 44_880 + 27_000 + 28_000],
  ])("ganancia %d → %d", (gain, tax) => {
    expect(spanishSavingsTax(gain)).toBeCloseTo(tax, 2)
  })

  it("redondea a céntimos", () => {
    expect(spanishSavingsTax(123.45)).toBe(23.46)   // 23,4555
  })
})

describe("estimateSpanishCapitalGainsTax", () => {
  it("aplica los tramos a cada año por separado", () => {
    const r = estimateSpanishCapitalGainsTax({ "2026": 10_000, "2027": 3_000 })
    expect(r.byYear).toEqual({ "2026": 1_980, "2027": 570 })
    expect(r.total).toBe(2_550)
  })

  it("las pérdidas del año compensan, sin arrastre al siguiente", () => {
    // 2026: +8 000 − 5 000 = 3 000 → 570. 2027: −2 000 → 0 (no reduce 2028).
    const r = estimateSpanishCapitalGainsTax({ "2026": 8_000 - 5_000, "2027": -2_000, "2028": 1_000 })
    expect(r.byYear).toEqual({ "2026": 570, "2027": 0, "2028": 190 })
    expect(r.total).toBe(760)
  })
})
