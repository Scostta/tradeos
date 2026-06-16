import { describe, it, expect } from "vitest"
import type { Trade } from "~/types/trade"
import {
  totalNetPnl,
  winRate,
  profitFactor,
  maxDrawdown,
  avgWin,
  avgLoss,
  equityCurve,
  pnlByDayOfWeek,
  computeDashboardMetrics,
} from "./metrics"

// Minimal valid Trade fixture; metrics only read netPnl, entryTime and id.
function trade(netPnl: number, entryTime = "2025-03-10T13:00:00.000Z", id = "t"): Trade {
  return {
    id,
    userId:      "00000000-0000-0000-0000-000000000000",
    accountId:   "00000000-0000-0000-0000-000000000000",
    tradeNumber: null,
    instrument:  "NQ",
    direction:   "long",
    contracts:   1,
    entryPrice:  1,
    exitPrice:   1,
    entryTime,
    exitTime:    entryTime,
    pnl:         netPnl,
    commission:  0,
    netPnl,
    mae:         null,
    mfe:         null,
    stopPrice:   null,
    playbookId:  null,
    session:     null,
    notes:       null,
    tags:        null,
    followedRules: null,
    createdAt:   entryTime,
  }
}

describe("totalNetPnl", () => {
  it("sums net P&L", () => {
    expect(totalNetPnl([trade(100), trade(-40), trade(10)])).toBe(70)
  })
  it("returns 0 for no trades", () => {
    expect(totalNetPnl([])).toBe(0)
  })
})

describe("winRate", () => {
  it("is the fraction of trades with positive net P&L", () => {
    expect(winRate([trade(10), trade(-5), trade(20), trade(-1)])).toBe(0.5)
  })
  it("treats break-even (0) as a loss", () => {
    expect(winRate([trade(0), trade(10)])).toBe(0.5)
  })
  it("returns 0 for no trades", () => {
    expect(winRate([])).toBe(0)
  })
})

describe("profitFactor", () => {
  it("is gross win over gross loss", () => {
    // wins: 100 + 50 = 150; losses: |-50| = 50 → 3
    expect(profitFactor([trade(100), trade(50), trade(-50)])).toBe(3)
  })
  it("falls back to gross win when there are no losses", () => {
    expect(profitFactor([trade(100), trade(20)])).toBe(120)
  })
})

describe("maxDrawdown", () => {
  it("is the largest peak-to-trough drop in cumulative equity", () => {
    // equity: 100, 50, 20, 100 → trough at 20, peak 100 → -80
    expect(maxDrawdown([trade(100), trade(-50), trade(-30), trade(80)])).toBe(-80)
  })
  it("is 0 when equity only rises", () => {
    expect(maxDrawdown([trade(10), trade(20)])).toBe(0)
  })
})

describe("avgWin / avgLoss", () => {
  it("averages winners and losers separately", () => {
    const trades = [trade(100), trade(50), trade(-30), trade(-10)]
    expect(avgWin(trades)).toBe(75)
    expect(avgLoss(trades)).toBe(-20)
  })
  it("returns 0 when a side has no trades", () => {
    expect(avgWin([trade(-5)])).toBe(0)
    expect(avgLoss([trade(5)])).toBe(0)
  })
})

describe("equityCurve", () => {
  it("accumulates net P&L sorted by entry time", () => {
    const curve = equityCurve([
      trade(50, "2025-03-12T13:00:00.000Z", "c"),
      trade(100, "2025-03-10T13:00:00.000Z", "a"),
      trade(-30, "2025-03-11T13:00:00.000Z", "b"),
    ])
    expect(curve.map(p => p.tradeId)).toEqual(["a", "b", "c"])
    expect(curve.map(p => p.equity)).toEqual([100, 70, 120])
  })
})

describe("pnlByDayOfWeek", () => {
  it("buckets net P&L by weekday (UTC)", () => {
    const buckets = pnlByDayOfWeek([
      trade(100, "2025-03-10T13:00:00.000Z"), // Monday
      trade(-20, "2025-03-10T15:00:00.000Z"), // Monday
      trade(40,  "2025-03-11T13:00:00.000Z"), // Tuesday
    ])
    const mon = buckets.find(b => b.key === "Mon")!
    const tue = buckets.find(b => b.key === "Tue")!
    expect(mon).toMatchObject({ net: 80, trades: 2 })
    expect(tue).toMatchObject({ net: 40, trades: 1 })
  })
})

describe("computeDashboardMetrics", () => {
  it("aggregates the dashboard figures", () => {
    const m = computeDashboardMetrics([trade(100), trade(-50), trade(25)])
    expect(m.netPnl).toBe(75)
    expect(m.totalTrades).toBe(3)
    expect(m.winners).toBe(2)
    expect(m.losers).toBe(1)
  })
})
