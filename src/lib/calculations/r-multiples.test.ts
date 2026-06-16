import { describe, it, expect } from "vitest"
import { rMultiple, computeRStats } from "./r-multiples"
import type { Trade } from "~/types/trade"

// NQ ($20/pt): default risk = |19850 − 19800| × 20 × 1 = $1000.
function tr(over: Partial<Trade>): Trade {
  return {
    id:          "00000000-0000-0000-0000-000000000000",
    userId:      "00000000-0000-0000-0000-000000000000",
    accountId:   "00000000-0000-0000-0000-000000000000",
    tradeNumber: null,
    instrument:  "NQ",
    direction:   "long",
    contracts:   1,
    entryPrice:  19850,
    exitPrice:   19850,
    entryTime:   "2026-06-10T15:00:00.000Z",
    exitTime:    "2026-06-10T15:30:00.000Z",
    pnl:         0,
    commission:  0,
    netPnl:      0,
    mae:         null,
    mfe:         null,
    stopPrice:   19800,
    strategyId:  null,
    session:     null,
    notes:       null,
    tags:        null,
    createdAt:   "2026-06-10T15:30:00.000Z",
    ...over,
  }
}

describe("rMultiple", () => {
  it("is net P&L divided by initial risk", () => {
    expect(rMultiple(tr({ netPnl: 2000 }))).toBe(2)    // 2000 / 1000
    expect(rMultiple(tr({ netPnl: -1000 }))).toBe(-1)
  })
  it("is null without a stop, for unknown instruments, or zero risk", () => {
    expect(rMultiple(tr({ stopPrice: null }))).toBeNull()
    expect(rMultiple(tr({ instrument: "FOO" }))).toBeNull()
    expect(rMultiple(tr({ stopPrice: 19850 }))).toBeNull()  // risk = 0
  })
  it("falls back to a flat risk when there is no stop", () => {
    expect(rMultiple(tr({ netPnl: 1000, stopPrice: null }), 500)).toBe(2)
    expect(rMultiple(tr({ stopPrice: null }), null)).toBeNull()
  })
  it("prefers the trade's own stop over the fallback", () => {
    // stop → risk 1000 → R = 2 (fallback of 500 would give 4)
    expect(rMultiple(tr({ netPnl: 2000 }), 500)).toBe(2)
  })
})

describe("computeRStats", () => {
  const trades = [
    tr({ netPnl: 2000 }),   // +2R
    tr({ netPnl: 1000 }),   // +1R
    tr({ netPnl: -1000 }),  // −1R
    tr({ netPnl: -1000 }),  // −1R
  ]

  it("aggregates expectancy, totals and win/loss R", () => {
    const s = computeRStats(trades)
    expect(s.coverage).toEqual({ withR: 4, total: 4 })
    expect(s.expectancy).toBe(0.25)   // (2+1−1−1)/4
    expect(s.totalR).toBe(1)
    expect(s.avgRWin).toBe(1.5)
    expect(s.avgRLoss).toBe(-1)
    expect(s.winRate).toBe(0.5)
    expect(s.bestR).toBe(2)
    expect(s.worstR).toBe(-1)
    expect(s.sqn).toBeCloseTo(0.38, 2)
  })

  it("buckets the distribution by R range", () => {
    const dist = computeRStats(trades).distribution
    const byLabel = Object.fromEntries(dist.map(b => [b.label, b.count]))
    expect(byLabel["0..1"]).toBe(1)
    expect(byLabel["1..2"]).toBe(1)
    expect(byLabel["−2..−1"]).toBe(2)
  })

  it("only counts trades that have a usable R (coverage)", () => {
    const s = computeRStats([...trades, tr({ netPnl: 500, stopPrice: null })])
    expect(s.coverage).toEqual({ withR: 4, total: 5 })
  })

  it("uses the per-account fallback risk for trades without a stop", () => {
    const acct = "00000000-0000-0000-0000-000000000000"
    const noStop = [tr({ netPnl: 1000, stopPrice: null }), tr({ netPnl: -500, stopPrice: null })]
    const s = computeRStats(noStop, new Map([[acct, 500]]))
    expect(s.coverage).toEqual({ withR: 2, total: 2 })   // both covered via fallback
    expect(s.expectancy).toBe(0.5)                        // (+2 −1) / 2
  })

  it("returns zeroed stats with an empty distribution when no trade has a stop", () => {
    const s = computeRStats([tr({ stopPrice: null }), tr({ stopPrice: null })])
    expect(s.coverage).toEqual({ withR: 0, total: 2 })
    expect(s.expectancy).toBe(0)
    expect(s.distribution).toHaveLength(8)
    expect(s.distribution.every(b => b.count === 0)).toBe(true)
  })
})
