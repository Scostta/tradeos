import { describe, it, expect } from "vitest"
import {
  benchmarkMonthlyReturns,
  buildPerformanceReport,
  reviewStats,
  testMonth,
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

/** Serie mensual; sin `raw`, el cierre sin ajustar es igual al ajustado (sin dividendos posteriores). */
function series(ticker: string, closes: Record<string, number>, raw: Record<string, number> = {}): InvestPrice[] {
  return Object.entries(closes).map(([m, adjClose]) => ({
    ticker, monthEnd: MONTH_ENDS[m], adjClose, close: raw[m] ?? adjClose,
  }))
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

// Total return implícito: acciones × close(apertura) × adj(m) / adj(apertura).
// Aquí close = adj (sin dividendos posteriores), así que se reduce a acciones × adj(m).
const aaa = (adj: number) => 40 * adj
const bbb = (adj: number, fx: number) => 100 * adj / fx

describe("satelliteMonthlyReturns", () => {
  // Valores a fin de mes calculados a mano (caja + posiciones en EUR).
  //            caja bruta                 posiciones                         V bruto
  // 2025-12    20 000                     —                                  20 000
  // 2026-01    16 000                     AAA 40 × 110 = 4 400               20 400    (apertura AAA)
  // 2026-02    16 000                     AAA 40 × 120 = 4 800               20 800    (sin movimientos)
  // 2026-03    16 000 − 4 545,45          AAA 5 000 + BBB 100 × 55 / 1,1     21 454,55 (apertura BBB)
  // 2026-04    11 454,55 + 40 × 128       BBB 100 × 60 / 1,2 = 5 000         21 574,55 (cierre AAA)
  // 2026-05    16 574,55                  BBB 100 × 66 / 1,1 = 6 000         22 574,55
  // 2026-06    16 574,55                  BBB 100 × 60 / 1,2 = 5 000         21 574,55
  const gross = [
    20_000,
    16_000 + aaa(110),
    16_000 + aaa(120),
    16_000 - BBB_COST + aaa(125) + bbb(55, 1.1),
    16_000 - BBB_COST + aaa(128) + bbb(60, 1.2),
    16_000 - BBB_COST + aaa(128) + bbb(66, 1.1),
    16_000 - BBB_COST + aaa(128) + bbb(60, 1.2),
  ]

  // Comisiones: −10 en enero, −5 en marzo, −10 en abril (acumuladas).
  const fees = [0, 10, 10, 15, 25, 25, 25]
  // Impuesto sobre el precio REAL de salida: 5 200 − 4 000 − 10 − 10 = 1 180 € → 19 % = 224,20 € en abril.
  const tax = [0, 0, 0, 0, 224.2, 224.2, 224.2]

  const result = satelliteMonthlyReturns([AAA, BBB], PRICES, SETTINGS, "2026-06")
  const ret = (v: number[], i: number) => v[i] / v[i - 1] - 1

  it("devuelve un punto por mes desde started_at, con el month_end real", () => {
    expect(result.map(r => r.monthEnd)).toEqual([
      "2026-01-30", "2026-02-27", "2026-03-31", "2026-04-30", "2026-05-29", "2026-06-30",
    ])
  })

  it("el primer tramo (compra → primer cierre mensual) cuenta", () => {
    // AAA compra a 100 y cierra enero a 110: 20 400 / 20 000.
    expect(result[0].gross).toBeCloseTo(0.02, 10)
  })

  it("bruto: caja + posiciones a total return, aperturas y cierres internos", () => {
    expect(result[1].gross).toBeCloseTo(20_800 / 20_400 - 1, 10)   // mes sin movimientos
    for (let i = 1; i <= 6; i++) expect(result[i - 1].gross).toBeCloseTo(ret(gross, i), 10)
  })

  it("el cierre entra a total return, no al precio real de salida", () => {
    // Abril: AAA cierra a 130 reales (5 200 €) pero suma 40 × 128 = 5 120 €.
    expect(gross[4] - gross[3]).toBeCloseTo(aaa(128) - aaa(125) + bbb(60, 1.2) - bbb(55, 1.1), 8)
    expect(result[3].gross).toBeCloseTo(ret(gross, 4), 10)
  })

  it("neto de comisiones", () => {
    const net = gross.map((v, i) => v - fees[i])
    expect(result[0].netFees).toBeCloseTo(0.0195, 10)                   // 20 390 / 20 000
    for (let i = 1; i <= 6; i++) expect(result[i - 1].netFees).toBeCloseTo(ret(net, i), 10)
  })

  it("neto de impuestos: se resta en el mes del cierre, sobre la ganancia real", () => {
    const net = gross.map((v, i) => v - fees[i] - tax[i])
    for (let i = 1; i <= 6; i++) expect(result[i - 1].netTax).toBeCloseTo(ret(net, i), 10)
    expect(result[3].netTax).toBeLessThan(result[3].netFees)
  })

  it("una pérdida posterior del mismo año devuelve el impuesto", () => {
    const loser: PerfPosition = {
      ticker: "BBB", currency: "USD", openedAt: "2026-03-10", entryPrice: 50, shares: 100,
      feesOpen: 0, closedAt: "2026-06-15", exitPrice: 30, feesClose: 0,
    }
    const r = satelliteMonthlyReturns([AAA, loser], PRICES, SETTINGS, "2026-06")
    // Junio: BBB cierra a total return (100 × 60 / 1,2, igual que si siguiera abierta).
    // Pérdida real = 100 × 30 / 1,2 − 4 545,45 = −2 045,45 → año en negativo → impuesto 0:
    // se devuelven los 224,20 € de abril.
    const vMayFees = gross[5] - 20
    const vJunFees = gross[6] - 20
    expect(r[5].netFees).toBeCloseTo(vJunFees / vMayFees - 1, 10)
    expect(r[5].netTax).toBeCloseTo(vJunFees / (vMayFees - 224.2) - 1, 10)
  })

  it("dividendo en el periodo: el satélite lo recoge vía adj_close aunque la salida real sea igual a la entrada", () => {
    // DIV paga un dividendo en febrero: Yahoo ajusta hacia atrás y el adj de enero queda en 95,
    // con cierre real de enero en 100. Compra 10 a 100 € (enero) y vende 10 a 100 € (marzo):
    // sin ganancia real, sin impuesto.
    const prices: InvestPrice[] = [
      ...PRICES,
      ...series("DIV.AS", { "2026-01": 95, "2026-02": 97, "2026-03": 100 }, { "2026-01": 100 }),
    ]
    const div: PerfPosition = {
      ticker: "DIV.AS", currency: "EUR", openedAt: "2026-01-10", entryPrice: 100, shares: 10,
      feesOpen: 0, closedAt: "2026-03-20", exitPrice: 100, feesClose: 0,
    }
    const r = satelliteMonthlyReturns([div], prices, SETTINGS, "2026-03")
    const total = chainReturns(r.map(x => x.gross)).at(-1)! / 100 - 1
    // 10 × 100 × 100/95 = 1 052,63 → (19 000 + 1 052,63) / 20 000 − 1 = +0,263 %
    expect(total).toBeCloseTo((19_000 + 1_000 * 100 / 95) / 20_000 - 1, 10)
    expect(r[1].gross).toBeCloseTo((19_000 + 1_000 * 97 / 95) / 20_000 - 1, 10)
    // Impuesto sobre la ganancia real (0): neto de impuestos = neto de comisiones = bruto.
    expect(r.map(x => x.netTax)).toEqual(r.map(x => x.gross))
  })

  it("primer tramo con dividendo posterior: se valora con el cierre real, no con el ajustado", () => {
    // Compra a 98; cierre real de enero 100 (adj 95 por el dividendo de febrero).
    // Enero vale 10 × 100 = 1 000 (no 10 × 95 = 950): (19 020 + 1 000) / 20 000 − 1 = +0,1 %.
    const prices: InvestPrice[] = [
      ...PRICES,
      ...series("DIV.AS", { "2026-01": 95, "2026-02": 97 }, { "2026-01": 100 }),
    ]
    const div: PerfPosition = {
      ticker: "DIV.AS", currency: "EUR", openedAt: "2026-01-10", entryPrice: 98, shares: 10,
      feesOpen: 0, closedAt: null, exitPrice: null, feesClose: 0,
    }
    const r = satelliteMonthlyReturns([div], prices, SETTINGS, "2026-02")
    expect(r[0].gross).toBeCloseTo((20_000 - 980 + 1_000) / 20_000 - 1, 10)
    expect(r[1].gross).toBeCloseTo((19_020 + 1_000 * 97 / 95) / 20_020 - 1, 10)
  })

  it("sin cierre real del mes de apertura (filas antiguas) la serie se corta", () => {
    const withoutRaw = PRICES.map(p => (p.ticker === "AAA.AS" && p.monthEnd === "2026-01-30" ? { ...p, close: null } : p))
    expect(satelliteMonthlyReturns([AAA], withoutRaw, SETTINGS, "2026-06")).toEqual([])
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

describe("testMonth", () => {
  it("el mes de started_at es el 1", () => {
    expect(testMonth("2026-10-15", "2026-10-27")).toBe(1)
    expect(testMonth("2026-10-15", "2026-11-01")).toBe(2)
    expect(testMonth("2026-10-15", "2029-09-30")).toBe(36)
    expect(testMonth("2026-10-15", "2029-10-01")).toBe(37)
  })
})

describe("buildPerformanceReport", () => {
  const sat = [
    { monthEnd: "2026-01-30", gross: 0.10, netFees: 0.09, netTax: 0.08 },
    { monthEnd: "2026-02-27", gross: 0.10, netFees: 0.10, netTax: 0.10 },
    { monthEnd: "2026-03-31", gross: 0.50, netFees: 0.50, netTax: 0.50 },  // sin benchmark: fuera del periodo común
  ]
  const bench = [
    { monthEnd: "2026-01-30", ret: 0.05 },
    { monthEnd: "2026-02-27", ret: -0.02 },
  ]
  const r = buildPerformanceReport(sat, bench, "2025-12-31")

  it("acumula sobre el periodo común", () => {
    expect(r.months).toBe(2)
    expect(r.satellite.gross).toBeCloseTo(1.1 * 1.1 - 1, 12)
    expect(r.satellite.netFees).toBeCloseTo(1.09 * 1.1 - 1, 12)
    expect(r.satellite.netTax).toBeCloseTo(1.08 * 1.1 - 1, 12)
    expect(r.benchmark).toBeCloseTo(1.05 * 0.98 - 1, 12)
    expect(r.diff).toBeCloseTo(1.08 * 1.1 - 1.05 * 0.98, 12)
  })

  it("puntos del gráfico base 100, con null donde una serie no llega", () => {
    expect(r.points[0]).toEqual({ monthEnd: "2025-12-31", satellite: 100, benchmark: 100 })
    expect(r.points[1].satellite).toBeCloseTo(108, 10)
    expect(r.points[2].benchmark).toBeCloseTo(102.9, 10)
    expect(r.points[3]).toEqual({ monthEnd: "2026-03-31", satellite: expect.closeTo(178.2, 8), benchmark: null })
  })
})

describe("reviewStats", () => {
  it("cuenta los runs desde el mes base y los revisados", () => {
    const runs = [
      { id: "r8", runDate: "2026-08-31" },   // anterior a la base (2026-09): no cuenta
      { id: "r9", runDate: "2026-09-30" },   // run de octubre, mes de started_at
      { id: "r10", runDate: "2026-10-30" },
      { id: "r11", runDate: "2026-11-30" },
    ]
    expect(reviewStats(runs, new Set(["r9", "r11", "r8"]), "2026-10-15")).toEqual({ reviewed: 2, total: 3 })
  })
})
