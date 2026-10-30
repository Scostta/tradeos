import { describe, it, expect } from "vitest"
import {
  buildInsightsInput,
  buildHourBuckets,
  buildTiltSignal,
  buildBreakEvenSignal,
  buildLimitsSignal,
  buildVolumeSignal,
} from "./insights-input"
import { computeTiltReport } from "./tilt"
import { computeBeReport } from "./be-analysis"
import type { Trade } from "~/types/trade"

// Minimal trade factory; only the fields the aggregation reads matter.
function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: "t", userId: "u", accountId: "a1", tradeNumber: null,
    instrument: "NQ", direction: "long", contracts: 1,
    entryPrice: 1, exitPrice: 1,
    entryTime: "2026-06-10T15:00:00.000Z", exitTime: "2026-06-10T15:30:00.000Z",
    pnl: 0, commission: 0, commissionEstimated: false, breakEven: false, beOverride: null, reviewedAt: null, netPnl: 0, mae: null, mfe: null, stopPrice: null,
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

  it("buckets by local hour when a timezone is given", () => {
    // 04:30Z is 23:00 CT (previous evening) and 13:00 JST.
    const t = [trade({ entryTime: "2026-06-11T04:30:00.000Z", netPnl: 100 })]
    expect(buildHourBuckets(t)[0]!.hour).toBe(4)                       // default UTC
    expect(buildHourBuckets(t, "America/Chicago")[0]!.hour).toBe(23)
    expect(buildHourBuckets(t, "Asia/Tokyo")[0]!.hour).toBe(13)
  })
})

describe("buildVolumeSignal timezone", () => {
  it("splits two late-night trades into separate local days in Chicago", () => {
    // Both on 2026-06-11 in UTC, but 23:30 CT (Jun 10) and 00:30 CT (Jun 11).
    const trades = [
      trade({ entryTime: "2026-06-11T04:30:00.000Z", netPnl: 10 }),
      trade({ entryTime: "2026-06-11T05:30:00.000Z", netPnl: 20 }),
    ]
    // Same UTC day → one trading day → < 2 days → zeroed groups.
    expect(buildVolumeSignal(trades).highVolumeDays.days).toBe(0)
    // Two local days in Chicago → median split applies.
    const ct = buildVolumeSignal(trades, "America/Chicago")
    expect(ct.highVolumeDays.days + ct.lowVolumeDays.days).toBe(2)
  })
})

describe("buildTiltSignal", () => {
  // Same day, account a1: loss (15:00–15:05) → re-entry 2 min later with 2 contracts (win) → BE.
  const trades = [
    trade({ id: "1", entryTime: "2026-06-10T15:00:00.000Z", exitTime: "2026-06-10T15:05:00.000Z", netPnl: -50 }),
    trade({ id: "2", entryTime: "2026-06-10T15:07:00.000Z", exitTime: "2026-06-10T15:20:00.000Z", netPnl: 100, contracts: 2 }),
    trade({ id: "3", entryTime: "2026-06-10T15:30:00.000Z", exitTime: "2026-06-10T15:40:00.000Z", netPnl: 1, breakEven: true }),
  ]
  const s = buildTiltSignal(computeTiltReport({ trades }), trades)

  it("places each trade against the previous one that day", () => {
    expect(s.byPreviousTrade.firstOfDay.trades).toBe(1)
    expect(s.byPreviousTrade.afterLoss).toMatchObject({ trades: 1, winRate: 1, avgNetPnl: 100 })
    expect(s.byPreviousTrade.afterWin.trades).toBe(1)
    expect(s.byPreviousTrade.afterBreakEven.trades).toBe(0)
  })

  it("fast re-entry and sizing up after a loss", () => {
    expect(s.afterLoss.reentryWindowMinutes).toEqual([5])
    expect(s.afterLoss.fastReentry.trades).toBe(1)
    expect(s.afterLoss.sizedUp.trades).toBe(1)
    expect(s.afterLoss.waitedLonger.trades).toBe(0)
  })

  it("streak and trade-number buckets, and the longest losing run", () => {
    expect(s.byLossStreakBefore["1"].trades).toBe(1)
    expect(s.byTradeNumberOfDay["3"].trades).toBe(1)
    expect(s.maxConsecutiveLosses).toBe(1)
    expect(s.baseline).toMatchObject({ trades: 3, winRate: 0.5 })
  })
})

describe("buildBreakEvenSignal", () => {
  it("null without BE trades", () => {
    expect(buildBreakEvenSignal(computeBeReport({ trades: [trade({ netPnl: 10 })], thresholdPoints: 1.5 }))).toBeNull()
  })

  it("summarizes the BE report and keeps only frequent groups above the overall rate", () => {
    // 6 trades at 15h (4 BE) and 4 at 16h (0 BE): overall 40 %, 15h = 67 % with ≥ 5 trades.
    const ts = [
      ...[0, 1, 2, 3].map(i => trade({ id: `b${i}`, entryTime: `2026-06-10T15:0${i}:00.000Z`, breakEven: true, commission: 2 })),
      ...[4, 5].map(i => trade({ id: `w${i}`, entryTime: `2026-06-10T15:0${i}:00.000Z`, exitPrice: 11, netPnl: 200 })),
      ...[0, 1, 2, 3].map(i => trade({ id: `x${i}`, entryTime: `2026-06-10T16:0${i}:00.000Z`, exitPrice: 11, netPnl: 200 })),
    ]
    const s = buildBreakEvenSignal(computeBeReport({ trades: ts, thresholdPoints: 1.5 }))!
    expect(s).toMatchObject({ trades: 4, rate: 0.4, commissions: 8, thresholdPoints: 1.5 })
    expect(s.highestRateGroups).toContainEqual({ dimension: "hour", label: "15:00", trades: 6, breakEvenTrades: 4, rate: 0.6667 })
    expect(s.highestRateGroups.find(g => g.label === "16:00")).toBeUndefined()
  })
})

describe("buildLimitsSignal", () => {
  it("null when no account has limits; counts per type otherwise", () => {
    expect(buildLimitsSignal(null)).toBeNull()
    const s = buildLimitsSignal(new Map([["1", ["revenge", "sizeUp"]], ["2", ["trades"]]]))
    expect(s).toEqual({
      tradesWithBreach: 2,
      byType: { maxTrades: 1, maxDailyLoss: 0, lossStreak: 0, fastReentryAfterLoss: 1, sizedUpAfterLoss: 1 },
    })
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
    expect(input.tilt.baseline.trades).toBe(3)
    expect(input.breakEven).toBeNull()
    expect(input.limits).toBeNull()
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
