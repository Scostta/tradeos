import { describe, it, expect } from "vitest"
import { computeBeStats } from "./be-analysis"
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
