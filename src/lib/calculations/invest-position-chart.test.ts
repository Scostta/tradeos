import { describe, it, expect } from "vitest"
import { exitLevel, smaSteps, stepsInRange } from "./invest-position-chart"
import type { InvestPrice } from "~/types/invest"

// Cierres mensuales 2025-01 … 2025-12 = 10, 20, …, 120 (adj_close).
const MONTHS = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`)
const prices: InvestPrice[] = MONTHS.map((m, i) => ({
  ticker: "ABC", monthEnd: `${m}-28`, adjClose: (i + 1) * 10, close: null,
}))

describe("smaSteps", () => {
  it("un escalón por cierre de mes con 10 meses consecutivos, en su month_end", () => {
    expect(smaSteps(prices, "ABC")).toEqual([
      { time: "2025-10-28", value: 55 },    // media de 10..100
      { time: "2025-11-28", value: 65 },
      { time: "2025-12-28", value: 75 },
    ])
  })

  it("usa adj_close, ignora otros tickers y salta ventanas con huecos", () => {
    const withGap = prices.filter(p => p.monthEnd !== "2025-05-28")
    const other: InvestPrice = { ticker: "XYZ", monthEnd: "2025-12-28", adjClose: 999, close: null }
    // Sin mayo, ninguna ventana de 10 meses hasta diciembre está completa.
    expect(smaSteps([...withGap, other], "ABC")).toEqual([])
  })
})

describe("stepsInRange", () => {
  const steps = smaSteps(prices, "ABC")   // 10-28: 55, 11-28: 65, 12-28: 75

  it("el escalón vigente al empezar arranca en la primera vela y el último llega a la última", () => {
    expect(stepsInRange(steps, "2025-11-10", "2026-01-15")).toEqual([
      { time: "2025-11-10", value: 55 },   // octubre seguía vigente el 10/11
      { time: "2025-11-28", value: 65 },
      { time: "2025-12-28", value: 75 },
      { time: "2026-01-15", value: 75 },
    ])
  })

  it("sin fechas repetidas cuando la ventana empieza justo en un cierre", () => {
    const out = stepsInRange(steps, "2025-11-28", "2025-12-28")
    expect(out).toEqual([{ time: "2025-11-28", value: 65 }, { time: "2025-12-28", value: 75 }])
    expect(new Set(out.map(s => s.time)).size).toBe(out.length)
  })

  it("una ventana anterior a la primera SMA no tiene escalones", () => {
    expect(stepsInRange(steps, "2025-01-01", "2025-06-01")).toEqual([])
    expect(stepsInRange([], "2025-01-01", "2026-01-01")).toEqual([])
  })
})

describe("exitLevel", () => {
  it("es la media de los 9 cierres anteriores al mes evaluado", () => {
    // Enero 2026: los 9 anteriores son abril…diciembre 2025 = 40…120.
    expect(exitLevel(prices, "ABC", "2026-01-30")).toBe(80)
  })

  it("en ese nivel el cierre iguala a su propia SMA 10; por debajo, queda bajo ella", () => {
    const level = exitLevel(prices, "ABC", "2026-01-30")!
    const previous = [40, 50, 60, 70, 80, 90, 100, 110, 120]
    const sma = (close: number) => (previous.reduce((a, v) => a + v, 0) + close) / 10
    expect(sma(level)).toBeCloseTo(level)
    expect(level - 1).toBeLessThan(sma(level - 1))
    expect(level + 1).toBeGreaterThan(sma(level + 1))
  })

  it("null si falta alguno de los 9 meses (el job no ha guardado el último)", () => {
    expect(exitLevel(prices, "ABC", "2026-02-27")).toBeNull()   // falta enero 2026
  })
})
