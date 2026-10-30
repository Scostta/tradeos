import { describe, it, expect } from "vitest"
import { computeTiltReport, tiltStats } from "./tilt"
import type { Trade } from "~/types/trade"

// NQ ($20/pt) con stop a 10 pts: riesgo $200 por contrato. Entrada y salida en UTC del 29-oct-2026.
function tr(id: string, entry: string, exit: string, netPnl: number, over: Partial<Trade> = {}): Trade {
  return {
    id,
    userId:      "00000000-0000-0000-0000-000000000000",
    accountId:   "a",
    tradeNumber: null,
    instrument:  "NQ",
    direction:   "long",
    contracts:   1,
    entryPrice:  20000,
    exitPrice:   20000 + netPnl / 20,
    entryTime:   `2026-10-29T${entry}:00.000Z`,
    exitTime:    `2026-10-29T${exit}:00.000Z`,
    pnl:         netPnl,
    commission:  0, commissionEstimated: false, breakEven: false, beOverride: null, reviewedAt: null,
    netPnl,
    mae: null, mfe: null,
    stopPrice:   19990,
    playbookId: null, session: null, notes: null, tags: null, followedRules: null, mistakes: null,
    createdAt:   "2026-10-29T20:00:00.000Z",
    ...over,
  }
}

describe("tiltStats", () => {
  it("win rate sin BE, neto medio y R medio", () => {
    const s = tiltStats([
      tr("1", "14:00", "14:10", 200),
      tr("2", "14:20", "14:30", -100),
      tr("3", "14:40", "14:50", 2, { breakEven: true }),
    ])
    expect(s).toEqual({ trades: 3, wins: 1, losses: 1, be: 1, winRate: 0.5, netPnl: 102, avgNet: 34, avgR: 0.17 })
  })

  it("sin trades", () => {
    expect(tiltStats([])).toMatchObject({ trades: 0, winRate: null, avgNet: null, avgR: null })
  })
})

describe("computeTiltReport", () => {
  // Un día en la cuenta a:
  //   1 gana                           → primero
  //   2 pierde, entra 1 min tras ganar → tras ganancia
  //   3 pierde, entra 3 min tras 2     → tras pérdida, rápido, racha 1
  //   4 gana con 2 contratos, 20 min   → tras pérdida, lento, sube contratos, racha 2
  //   5 BE                             → tras ganancia
  //   6 pierde tras el BE              → tras BE
  const day = [
    tr("1", "14:00", "14:10", 100),
    tr("2", "14:11", "14:20", -100),
    tr("3", "14:23", "14:30", -50),
    tr("4", "14:50", "15:00", 300, { contracts: 2 }),
    tr("5", "15:10", "15:20", 2, { breakEven: true }),
    tr("6", "15:21", "15:30", -40),
  ]
  // Otra cuenta el mismo día: no mezcla contexto con la cuenta a.
  const other = tr("b1", "14:24", "14:40", 80, { accountId: "b" })
  const r = computeTiltReport({ trades: [...day, other] })

  it("según el trade anterior (por cuenta y día)", () => {
    expect(r.previous.map(p => [p.key, p.stats.trades])).toEqual([["first", 2], ["win", 2], ["loss", 2], ["be", 1]])
    expect(r.previous.find(p => p.key === "loss")!.stats).toMatchObject({ wins: 1, losses: 1, netPnl: 250 })
  })

  it("según la racha de pérdidas previa", () => {
    // 6 va tras un BE que va tras una ganancia: racha 0 (los BE no cortan ni suman)
    expect(r.streak.map(p => [p.key, p.stats.trades])).toEqual([["0", 5], ["1", 1], ["2", 1], ["3+", 0]])
  })

  it("según los minutos desde la última salida, separando tras pérdida", () => {
    const byKey = new Map(r.gap.map(g => [g.key, [g.afterLoss.trades, g.other.trades]]))
    expect(Object.fromEntries(byKey)).toEqual({
      lt2: [0, 2], "2to5": [1, 0], "5to15": [0, 1], "15to60": [1, 0], gt60: [0, 0],
    })
  })

  it("tras una pérdida: rápido vs. lento y sube contratos vs. igual", () => {
    expect(r.afterLoss.fast).toMatchObject({ trades: 1, netPnl: -50 })
    expect(r.afterLoss.slow).toMatchObject({ trades: 1, netPnl: 300 })
    expect(r.afterLoss.sizeUp).toMatchObject({ trades: 1, netPnl: 300 })
    expect(r.afterLoss.sameSize).toMatchObject({ trades: 1, netPnl: -50 })
  })

  it("usa el plazo de cada cuenta", () => {
    const x = computeTiltReport({ trades: day, revengeMinutes: new Map([["a", 30]]) })
    expect(x.afterLoss.fast.trades).toBe(2)
    expect(x.windows).toEqual([30])
    expect(r.windows).toEqual([5])
  })

  it("según el número de trade del día", () => {
    expect(r.tradeNumber.map(p => [p.key, p.stats.trades])).toEqual([["1", 2], ["2", 1], ["3", 1], ["4+", 3]])
  })
})
