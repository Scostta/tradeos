import { describe, it, expect } from "vitest"
import {
  benchmarkMonthlyReturns,
  chainReturns,
  performanceBaseMonth,
  satelliteMonthlyReturns,
} from "./invest-performance"
import type { PerfPosition } from "./invest-performance"
import type { InvestPrice } from "~/types/invest"

const MONTH_ENDS: Record<string, string> = {
  "2025-12": "2025-12-31",
  "2026-01": "2026-01-30",
  "2026-02": "2026-02-27",
  "2026-03": "2026-03-31",
  "2026-04": "2026-04-30",
  "2026-05": "2026-05-29",
  "2026-06": "2026-06-30",
}

function series(ticker: string, closes: Record<string, number>): InvestPrice[] {
  return Object.entries(closes).map(([m, adjClose]) => ({ ticker, monthEnd: MONTH_ENDS[m], adjClose }))
}

const PRICES: InvestPrice[] = [
  // USD por 1 EUR
  ...series("EURUSD=X", {
    "2025-12": 1.1, "2026-01": 1.1, "2026-02": 1.1, "2026-03": 1.1,
    "2026-04": 1.2, "2026-05": 1.1, "2026-06": 1.2,
  }),
  ...series("AAA.AS", { "2026-01": 110, "2026-02": 120, "2026-03": 125, "2026-04": 128 }),
  ...series("BBB", { "2026-03": 55, "2026-04": 60, "2026-05": 66, "2026-06": 60 }),
  ...series("IWDA.AS", {
    "2025-12": 100, "2026-01": 101, "2026-02": 103, "2026-03": 102,
    "2026-04": 105, "2026-05": 106, "2026-06": 104,
  }),
]

// Satélite: 100 000 × 20 % = 20 000 € de caja al cierre de 2025-12.
const SETTINGS = { totalPortfolioValue: 100_000, satellitePct: 0.2, startedAt: "2026-01-01" }

// AAA (EUR): abre 15/01 a 100 × 40 (4 000 €, comisión 10), cierra 20/04 a 130 (5 200 €, comisión 10).
// BBB (USD): abre 10/03 a 50 USD × 100 con EURUSD 1,10 (4 545,45 €, comisión 5); sigue abierta.
const AAA: PerfPosition = {
  ticker: "AAA.AS", currency: "EUR", openedAt: "2026-01-15", entryPrice: 100, shares: 40,
  feesOpen: 10, closedAt: "2026-04-20", exitPrice: 130, feesClose: 10,
}
const BBB: PerfPosition = {
  ticker: "BBB", currency: "USD", openedAt: "2026-03-10", entryPrice: 50, shares: 100,
  feesOpen: 5, closedAt: null, exitPrice: null, feesClose: 0,
}

const BBB_COST = 5000 / 1.1   // 4 545,4545 €

describe("satelliteMonthlyReturns", () => {
  // Valores a fin de mes calculados a mano (caja + posiciones en EUR).
  //            caja bruta              posiciones                        V bruto
  // 2025-12    20 000                  —                                 20 000
  // 2026-01    16 000                  40 × 110 = 4 400                  20 400   (apertura AAA)
  // 2026-02    16 000                  40 × 120 = 4 800                  20 800   (sin movimientos)
  // 2026-03    16 000 − 4 545,45       5 000 + 100 × 55 / 1,1 = 5 000    21 454,55 (apertura BBB)
  // 2026-04    11 454,55 + 5 200       100 × 60 / 1,2 = 5 000            21 654,55 (cierre AAA)
  // 2026-05    16 654,55               100 × 66 / 1,1 = 6 000            22 654,55
  // 2026-06    16 654,55               100 × 60 / 1,2 = 5 000            21 654,55
  const gross = [
    20_000,
    20_400,
    20_800,
    16_000 - BBB_COST + 5_000 + 5_000,
    16_000 - BBB_COST + 5_200 + 5_000,
    16_000 - BBB_COST + 5_200 + 6_000,
    16_000 - BBB_COST + 5_200 + 5_000,
  ]

  // Comisiones: −10 en enero, −5 en marzo, −10 en abril (acumuladas).
  const fees = [0, 10, 10, 15, 25, 25, 25]
  // Impuesto: ganancia de AAA = 5 200 − 4 000 − 10 − 10 = 1 180 € → 19 % = 224,20 € en abril.
  const tax = [0, 0, 0, 0, 224.2, 224.2, 224.2]

  const result = satelliteMonthlyReturns([AAA, BBB], PRICES, SETTINGS, "2026-06")
  const ret = (v: number[], i: number) => v[i] / v[i - 1] - 1

  it("devuelve un punto por mes desde started_at, con el month_end real", () => {
    expect(result.map(r => r.monthEnd)).toEqual([
      "2026-01-30", "2026-02-27", "2026-03-31", "2026-04-30", "2026-05-29", "2026-06-30",
    ])
  })

  it("bruto: caja + posiciones, aperturas y cierres como movimientos internos", () => {
    expect(result[0].gross).toBeCloseTo(0.02, 10)                 // 20 400 / 20 000
    expect(result[1].gross).toBeCloseTo(20_800 / 20_400 - 1, 10)  // mes sin movimientos
    for (let i = 1; i <= 6; i++) expect(result[i - 1].gross).toBeCloseTo(ret(gross, i), 10)
  })

  it("neto de comisiones", () => {
    const net = gross.map((v, i) => v - fees[i])
    expect(result[0].netFees).toBeCloseTo(0.0195, 10)             // 20 390 / 20 000
    for (let i = 1; i <= 6; i++) expect(result[i - 1].netFees).toBeCloseTo(ret(net, i), 10)
  })

  it("neto de impuestos: se resta en el mes del cierre", () => {
    const net = gross.map((v, i) => v - fees[i] - tax[i])
    for (let i = 1; i <= 6; i++) expect(result[i - 1].netTax).toBeCloseTo(ret(net, i), 10)
    // Abril: (21 654,55 − 25 − 224,20) / (21 454,55 − 15) − 1
    expect(result[3].netTax).toBeCloseTo((gross[4] - 249.2) / (gross[3] - 15) - 1, 10)
    expect(result[3].netTax).toBeLessThan(result[3].netFees)
  })

  it("una pérdida posterior del mismo año devuelve el impuesto", () => {
    const loser: PerfPosition = {
      ticker: "BBB", currency: "USD", openedAt: "2026-03-10", entryPrice: 50, shares: 100,
      feesOpen: 0, closedAt: "2026-06-15", exitPrice: 30, feesClose: 0,
    }
    const r = satelliteMonthlyReturns([AAA, loser], PRICES, SETTINGS, "2026-06")
    // Junio: pérdida de BBB = 100 × 30 / 1,2 − 4 545,45 = −2 045,45 → ganancia del año < 0 → impuesto 0.
    // Se devuelven los 224,20 €: neto de impuestos y neto de comisiones coinciden en valor.
    const vMay = 20_000 - 4_000 - 10 - 10 + 5_200 - BBB_COST + 6_000
    const vJunFees = 20_000 - 4_000 - 10 - 10 + 5_200 - BBB_COST + 2_500
    expect(r[5].netFees).toBeCloseTo(vJunFees / vMay - 1, 10)
    expect(r[5].netTax).toBeCloseTo(vJunFees / (vMay - 224.2) - 1, 10)
  })

  it("se corta en el último mes con todos los precios", () => {
    const withoutMay = PRICES.filter(p => !(p.ticker === "BBB" && p.monthEnd === "2026-05-29"))
    const r = satelliteMonthlyReturns([AAA, BBB], withoutMay, SETTINGS, "2026-06")
    expect(r.map(x => x.monthEnd)).toEqual(["2026-01-30", "2026-02-27", "2026-03-31", "2026-04-30"])
  })

  it("una posición con divisa desconocida no se valora", () => {
    const r = satelliteMonthlyReturns([{ ...BBB, currency: null }], PRICES, SETTINGS, "2026-06")
    expect(r.map(x => x.monthEnd)).toEqual(["2026-01-30", "2026-02-27"])
  })

  it("sin posiciones, la caja rinde 0", () => {
    const r = satelliteMonthlyReturns([], PRICES, SETTINGS, "2026-03")
    expect(r.map(x => x.gross)).toEqual([0, 0, 0])
  })
})

describe("benchmarkMonthlyReturns", () => {
  it("parte del cierre anterior a started_at", () => {
    expect(performanceBaseMonth("2026-01-01")).toBe("2025-12")
    const r = benchmarkMonthlyReturns(PRICES, "IWDA.AS", "2026-01-01")
    expect(r).toHaveLength(6)
    expect(r[0]).toEqual({ monthEnd: "2026-01-30", ret: expect.closeTo(0.01, 10) })
    expect(r[2].ret).toBeCloseTo(102 / 103 - 1, 10)
    expect(chainReturns(r.map(x => x.ret)).at(-1)).toBeCloseTo(104, 8)
  })

  it("respeta through y se corta sin cierre", () => {
    expect(benchmarkMonthlyReturns(PRICES, "IWDA.AS", "2026-01-01", "2026-02")).toHaveLength(2)
    expect(benchmarkMonthlyReturns(PRICES, "XXX", "2026-01-01")).toEqual([])
  })
})

describe("chainReturns", () => {
  it("encadena desde base 100", () => {
    expect(chainReturns([0.1, -0.1])).toEqual([100, expect.closeTo(110, 10), expect.closeTo(99, 10)])
    expect(chainReturns([])).toEqual([100])
  })
})
