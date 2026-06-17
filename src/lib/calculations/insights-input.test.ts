import { describe, it, expect } from "vitest"
import {
  buildInsightsInput,
  buildHourBuckets,
  buildStreakSignal,
  buildVolumeSignal,
} from "./insights-input"
import type { Trade } from "~/types/trade"

// Minimal trade factory; only the fields the aggregation reads matter.
function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: "t", userId: "u", accountId: "a1", tradeNumber: null,
    instrument: "NQ", direction: "long", contracts: 1,
    entryPrice: 1, exitPrice: 1,
    entryTime: "2026-06-10T15:00:00.000Z", exitTime: "2026-06-10T15:30:00.000Z",
    pnl: 0, commission: 0, netPnl: 0, mae: null, mfe: null, stopPrice: null,
    playbookId: null, session: null, notes: null, tags: null,
    followedRules: null, mistakes: null, createdAt: "2026-06-10T15:30:00.000Z",
    ...over,
  }
}

describe("buildHourBuckets", () => {
  it("groups by UTC hour with win rate and net P&L, sorted by hour", () => {
    const buckets = buildHourBuckets([
      trade({ entryTime: "2026-06-10T14:05:00.000Z", netPnl: 100 }),
      trade({ entryTime: "2026-06-10T14:40:00.000Z", netPnl: -40 }),
      trade({ entryTime: "2026-06-10T16:10:00.000Z", netPnl: 200 }),
    ])
    expect(buckets.map(b => b.hour)).toEqual([14, 16])
    expect(buckets[0]).toMatchObject({ hour: 14, trades: 2, winRate: 0.5, netPnl: 60 })
    expect(buckets[1]).toMatchObject({ hour: 16, trades: 1, winRate: 1, netPnl: 200 })
  })

  it("returns an empty array for no trades", () => {
    expect(buildHourBuckets([])).toEqual([])
  })
})

describe("buildStreakSignal", () => {
  it("isolates trades that follow a loss within the same account", () => {
    // a1: loss → the +100 follows a loss; a2 untouched.
    const s = buildStreakSignal([
      trade({ accountId: "a1", entryTime: "2026-06-10T15:00:00.000Z", netPnl: -50 }),
      trade({ accountId: "a1", entryTime: "2026-06-10T15:30:00.000Z", netPnl: 100 }),
      trade({ accountId: "a2", entryTime: "2026-06-10T15:15:00.000Z", netPnl: 80 }),
    ])
    expect(s.afterLoss).toMatchObject({ trades: 1, winRate: 1, avgNetPnl: 100 })
    expect(s.baseline.trades).toBe(3)
    expect(s.maxConsecutiveLosses).toBe(1)
  })

  it("counts the longest consecutive-loss run per account", () => {
    const s = buildStreakSignal([
      trade({ entryTime: "2026-06-10T15:00:00.000Z", netPnl: -10 }),
      trade({ entryTime: "2026-06-10T15:01:00.000Z", netPnl: -10 }),
      trade({ entryTime: "2026-06-10T15:02:00.000Z", netPnl: -10 }),
      trade({ entryTime: "2026-06-10T15:03:00.000Z", netPnl: 50 }),
    ])
    expect(s.maxConsecutiveLosses).toBe(3)
    // 3 trades follow a loss (the 2nd, 3rd, and 4th).
    expect(s.afterLoss.trades).toBe(3)
  })

  it("orders by entryTime, not array order", () => {
    const s = buildStreakSignal([
      trade({ entryTime: "2026-06-10T16:00:00.000Z", netPnl: 100 }), // chronologically 2nd
      trade({ entryTime: "2026-06-10T15:00:00.000Z", netPnl: -50 }), // chronologically 1st
    ])
    expect(s.afterLoss).toMatchObject({ trades: 1, avgNetPnl: 100 })
  })
})

describe("buildVolumeSignal", () => {
  it("splits days at the median and contrasts busy vs quiet days", () => {
    // Day 1: 1 trade (+100). Day 2: 3 trades net -90. Median count = 2.
    const v = buildVolumeSignal([
      trade({ entryTime: "2026-06-10T15:00:00.000Z", netPnl: 100 }),
      trade({ entryTime: "2026-06-11T15:00:00.000Z", netPnl: -30 }),
      trade({ entryTime: "2026-06-11T15:10:00.000Z", netPnl: -30 }),
      trade({ entryTime: "2026-06-11T15:20:00.000Z", netPnl: -30 }),
    ])
    expect(v.medianTradesPerDay).toBe(2)
    expect(v.highVolumeDays).toMatchObject({ days: 1, avgDailyNetPnl: -90, avgTradesPerDay: 3 })
    expect(v.lowVolumeDays).toMatchObject({ days: 1, avgDailyNetPnl: 100, avgTradesPerDay: 1 })
  })

  it("returns zeroed groups with fewer than two trading days", () => {
    const v = buildVolumeSignal([trade({ netPnl: 100 }), trade({ netPnl: 50 })])
    expect(v.highVolumeDays.days).toBe(0)
    expect(v.lowVolumeDays.days).toBe(0)
  })
})

describe("buildInsightsInput", () => {
  it("assembles overview and behavioral signals from trades alone", () => {
    const input = buildInsightsInput([
      trade({ netPnl: 200, session: "RTH" }),
      trade({ netPnl: -100, session: "RTH" }),
      trade({ netPnl: 50, session: "ETH" }),
    ])
    expect(input.overview.totalTrades).toBe(3)
    expect(input.overview.netPnl).toBe(150)
    expect(input.bySession.map(s => s.session)).toEqual(["RTH", "ETH"])
    expect(input.rMultiples).toBeNull()
    expect(input.adherence).toBeNull()
    expect(input.streaks.baseline.trades).toBe(3)
  })

  it("includes R-multiple and adherence signals when provided", () => {
    const input = buildInsightsInput([trade({ netPnl: 100 })], {
      rStats: {
        coverage: { withR: 10, total: 10 }, expectancy: 0.45, totalR: 4.5,
        avgRWin: 1.2, avgRLoss: -0.8, winRate: 0.6, sqn: 1.8, bestR: 3, worstR: -1.5,
        distribution: [],
      },
      adherence: {
        totalRules: 6, tracked: 8,
        followed: { count: 5, winRate: 0.8, netPnl: 600, expectancyR: 1.1, rCoverage: { withR: 5, total: 5 } },
        broke:    { count: 3, winRate: 0.33, netPnl: -200, expectancyR: -0.4, rCoverage: { withR: 3, total: 3 } },
      },
    })
    expect(input.rMultiples).toMatchObject({ expectancy: 0.45, sqn: 1.8, coverage: { withR: 10, total: 10 } })
    expect(input.adherence).toMatchObject({ tracked: 8, followedWinRate: 0.8, brokeNetPnl: -200 })
  })
})
