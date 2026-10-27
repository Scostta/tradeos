import { describe, it, expect } from "vitest"
import { chartFrom, fundamentalsWithChanges, priceChartSeries, thesisFromDraft } from "./invest-detail"
import { monthRange } from "./invest-fx"
import type { InvestPrice } from "~/types/invest"

function monthly(ticker: string, from: string, to: string, value: (i: number) => number): InvestPrice[] {
  return monthRange(from, to).map((m, i) => ({ ticker, monthEnd: `${m}-28`, adjClose: value(i), close: value(i) }))
}

describe("priceChartSeries", () => {
  // 40 meses: el gráfico se queda con los 36 últimos.
  const prices = [
    ...monthly("MU", "2023-06", "2026-09", i => 100 + i),
    ...monthly("IWDA.AS", "2023-06", "2026-09", () => 50),
  ]
  const series = priceChartSeries(prices, "MU", "IWDA.AS")

  it("36 últimos meses del ticker", () => {
    expect(series).toHaveLength(36)
    expect(series[0].month).toBe("2023-10")
    expect(series.at(-1)!.month).toBe("2026-09")
  })

  it("SMA 10 con los 10 últimos cierres; null si faltan", () => {
    // 2026-09 es i = 39: media de 130..139 = 134,5
    expect(series.at(-1)!.sma10).toBeCloseTo(134.5, 10)
    const short = priceChartSeries(monthly("NEW", "2026-01", "2026-09", () => 10), "NEW", "IWDA.AS")
    expect(short.every(p => p.sma10 === null)).toBe(true)
  })

  it("ratio precio/benchmark indexado a 100 en el primer mes", () => {
    expect(series[0].relative).toBeCloseTo(100, 10)
    // benchmark constante: el ratio sigue al precio (139 / 104)
    expect(series.at(-1)!.relative).toBeCloseTo((139 / 104) * 100, 10)
  })

  it("sin benchmark: relative null; sin precios: serie vacía", () => {
    expect(priceChartSeries(prices, "MU", "OTHER")[0].relative).toBeNull()
    expect(priceChartSeries(prices, "NONE", "IWDA.AS")).toEqual([])
  })
})

describe("fundamentalsWithChanges", () => {
  const rows = [
    { ticker: "X", fiscalYear: 2023, revenue: 100, grossMargin: 0.5, fcf: -10, roic: 0.1, netDebtEbitda: 1 },
    { ticker: "X", fiscalYear: 2025, revenue: 150, grossMargin: 0.55, fcf: 30, roic: 0.2, netDebtEbitda: 0.5 },
    { ticker: "X", fiscalYear: 2024, revenue: 120, grossMargin: 0.52, fcf: 20, roic: null, netDebtEbitda: 0.8 },
  ]
  const out = fundamentalsWithChanges(rows)

  it("ordena del más reciente y calcula la variación interanual", () => {
    expect(out.map(r => r.fiscalYear)).toEqual([2025, 2024, 2023])
    expect(out[0].revenueYoY).toBeCloseTo(0.25, 12)
    expect(out[0].fcfYoY).toBeCloseTo(0.5, 12)
    expect(out[0].grossMarginDelta).toBeCloseTo(0.03, 12)
  })

  it("null si falta el año anterior, el dato o la base es <= 0", () => {
    expect(out[1].fcfYoY).toBeNull()           // base −10
    expect(out[0].roicDelta).toBeNull()        // 2024 sin ROIC
    expect(out[2].revenueYoY).toBeNull()       // sin 2022
  })
})

describe("thesisFromDraft", () => {
  const labels = { growth: "Growth?", stopper: "Stopper?", loser: "Loser?", signal: "Signal?" }

  it("tesis con las cuatro respuestas y falsadores = respuestas 2 y 4", () => {
    const r = thesisFromDraft({ growth: "AI demand", stopper: "Capex cut", loser: "Old DRAM", signal: "HBM share" }, labels)
    expect(r.thesis).toBe("Growth?\nAI demand\n\nStopper?\nCapex cut\n\nLoser?\nOld DRAM\n\nSignal?\nHBM share")
    expect(r.falsifiers).toEqual(["Capex cut", "HBM share"])
  })

  it("omite respuestas vacías en la tesis y deja huecos en los falsadores", () => {
    const r = thesisFromDraft({ growth: "x", stopper: "", loser: " ", signal: "" }, labels)
    expect(r.thesis).toBe("Growth?\nx")
    expect(r.falsifiers).toEqual(["", ""])
  })
})

describe("chartFrom", () => {
  it("pide desde 37 meses atrás", () => {
    expect(chartFrom("2026-10-28")).toBe("2023-09-01")
  })
})
