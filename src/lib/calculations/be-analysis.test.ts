import { describe, it, expect } from "vitest"
import { computeBeReport, computeBeStats, isBeAt } from "./be-analysis"
import type { Trade } from "~/types/trade"

// NQ ($20/pt), stop a 10 pts: riesgo = $200 por contrato.
function tr(over: Partial<Trade>): Trade {
  return {
    id:          "t",
    userId:      "00000000-0000-0000-0000-000000000000",
    accountId:   "a",
    tradeNumber: null,
    instrument:  "NQ",
    direction:   "long",
    contracts:   1,
    entryPrice:  20000,
    exitPrice:   20000,
    entryTime:   "2026-10-29T14:00:00.000Z",
    exitTime:    "2026-10-29T14:10:00.000Z",
    pnl:         0,
    commission:  0, commissionEstimated: false, breakEven: true, beOverride: null, reviewedAt: null,
    netPnl:      0,
    mae:         null,
    mfe:         null,
    stopPrice:   19990,
    playbookId:  null,
    session:     null,
    notes:       null,
    tags:        null,
    followedRules: null,
    mistakes:    null,
    createdAt:   "2026-10-29T14:10:00.000Z",
    ...over,
  }
}

describe("computeBeStats", () => {
  const trades = [
    tr({ id: "a", mfe: 300, netPnl: -4 }),             // 1.5R
    tr({ id: "b", mfe: 60,  netPnl: 2 }),              // 0.3R
    tr({ id: "c", mfe: 500, netPnl: 0 }),              // 2.5R
    tr({ id: "d", mfe: null }),                        // sin MFE: no se mide
    tr({ id: "e", mfe: 100, stopPrice: null }),        // sin stop ni riesgo de cuenta: no se mide
    tr({ id: "f", mfe: 900, breakEven: false }),       // no es BE
  ]

  it("cuenta los BE y mide solo los que tienen MFE y riesgo", () => {
    const s = computeBeStats(trades)
    expect(s).toMatchObject({ total: 5, measured: 3 })
    expect(s.rows.map(r => [r.id, r.mfeR])).toEqual([["c", 2.5], ["a", 1.5], ["b", 0.3]])
  })

  it("cuántos llegaron a +0.5R, +1R y +2R y la media", () => {
    const s = computeBeStats(trades)
    expect(s.reached).toEqual([{ level: 0.5, count: 2 }, { level: 1, count: 2 }, { level: 2, count: 1 }])
    expect(s.avgMfeR).toBe(1.43)
  })

  it("lo dejado sobre la mesa a 1R: 1R de los que lo tocaron menos lo que dieron", () => {
    expect(computeBeStats(trades).missedAt1R).toBe(404)   // (200 − (−4)) + (200 − 0)
  })

  it("sin stop usa el riesgo por trade de la cuenta", () => {
    const s = computeBeStats([tr({ id: "e", mfe: 100, stopPrice: null })], new Map([["a", 50]]))
    expect(s.rows[0]).toMatchObject({ mfeR: 2, risk: 50 })
  })

  it("sin BE medibles", () => {
    expect(computeBeStats([tr({ mfe: null })])).toMatchObject({ total: 1, measured: 0, avgMfeR: null, missedAt1R: 0 })
  })
})

describe("computeBeReport", () => {
  // Riesgo $200 (NQ, stop a 10 pts). Martes 27 y jueves 29 de octubre de 2026, y lunes 9 de noviembre.
  const trades = [
    tr({ id: "a", entryTime: "2026-10-27T14:00:00.000Z", mae: -160, mfe: 300, netPnl: -4, commission: 4 }),
    tr({ id: "b", entryTime: "2026-10-27T15:30:00.000Z", mae: -20,  mfe: 40,  netPnl: 2,  commission: 4, direction: "short" }),
    tr({ id: "c", entryTime: "2026-10-29T14:20:00.000Z", exitPrice: 20010, breakEven: false, netPnl: 196, commission: 4 }),
    tr({ id: "d", entryTime: "2026-11-09T14:05:00.000Z", exitPrice: 20002, beOverride: true, mae: -100, netPnl: 36 }),
    tr({ id: "e", entryTime: "2026-11-09T16:00:00.000Z", exitPrice: 20001, breakEven: false, beOverride: false, netPnl: 16, instrument: "MNQ" }),
  ]
  const r = computeBeReport({
    trades, thresholdPoints: 1.5,
    playbookName: t => t.id === "a" ? "ORB" : null,
  })

  it("resumen: tasa, neto y comisiones de los BE", () => {
    expect(r).toMatchObject({ trades: 5, rate: 0.6, netPnl: 34, commission: 8 })
    expect(r.stats.total).toBe(3)
  })

  it("tasa de BE por grupo", () => {
    expect(r.groups.hour.map(g => [g.label, g.be, g.trades])).toEqual([["14:00", 2, 3], ["15:00", 1, 1], ["16:00", 0, 1]])
    expect(r.groups.weekday.map(g => [g.label, g.rate])).toEqual([["Mon", 0.5], ["Tue", 1], ["Thu", 0]])
    expect(r.groups.instrument.map(g => [g.label, g.trades])).toEqual([["NQ", 4], ["MNQ", 1]])
    expect(r.groups.playbook.map(g => [g.label, g.be])).toEqual([[null, 2], ["ORB", 1]])
    expect(r.groups.direction.map(g => [g.label, g.be])).toEqual([["long", 2], ["short", 1]])
  })

  it("MAE en R de los BE: casi stop y sin riesgo", () => {
    expect(r.mae).toMatchObject({ measured: 3, avgMaeR: 0.47, nearStop: 1, neverAtRisk: 1 })
    expect(r.mae.points).toEqual([{ id: "a", maeR: 0.8, mfeR: 1.5 }, { id: "b", maeR: 0.1, mfeR: 0.2 }])
  })

  it("evolución por semanas de domingo a sábado, con huecos y devuelto acumulado", () => {
    expect(r.evolution.unit).toBe("week")
    expect(r.evolution.periods).toEqual([
      { key: "2026-10-25", trades: 3, be: 2, rate: 0.6667, missed: 204, cumMissed: 204 },
      { key: "2026-11-01", trades: 0, be: 0, rate: null,   missed: 0,   cumMissed: 204 },
      { key: "2026-11-08", trades: 2, be: 1, rate: 0.5,    missed: 0,   cumMissed: 204 },
    ])
  })

  it("por meses si el rango pasa de medio año", () => {
    const long = computeBeReport({
      trades: [tr({ entryTime: "2026-01-05T15:00:00.000Z" }), tr({ entryTime: "2026-10-05T15:00:00.000Z" })],
      thresholdPoints: 1.5,
    })
    expect(long.evolution.unit).toBe("month")
    expect(long.evolution.periods.map(p => p.key)).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ])
  })

  it("origen de la etiqueta: umbral o corrección manual", () => {
    expect(r.source).toMatchObject({ threshold: 1.5, auto: 2, forcedBe: 1, forcedNotBe: 1 })
    expect(r.source.whatIf.every(w => w.be === 3)).toBe(true)   // c (10 pts) nunca; d y e mandan sus correcciones
  })

  it("con otro umbral, respetando las correcciones", () => {
    expect(isBeAt(tr({ exitPrice: 20002.5 }), 2.5)).toBe(true)
    expect(isBeAt(tr({ exitPrice: 20002.5 }), 2)).toBe(false)
    expect(isBeAt(tr({ exitPrice: 20002.5, beOverride: false }), 3)).toBe(false)
    const x = computeBeReport({ trades: [tr({ exitPrice: 20001.75 })], thresholdPoints: 1.75 })
    expect(x.source.whatIf.map(w => w.points)).toEqual([0.5, 1, 1.5, 1.75, 2, 2.5, 3])
    expect(x.source.whatIf.map(w => w.be)).toEqual([0, 0, 0, 1, 1, 1, 1])
  })

  it("sin trades", () => {
    const x = computeBeReport({ trades: [], thresholdPoints: 1.5 })
    expect(x).toMatchObject({ trades: 0, rate: 0, evolution: { unit: "week", periods: [] } })
  })
})
