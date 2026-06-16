import { describe, it, expect } from "vitest"
import { computeGoalsProgress } from "./goals"
import type { Goals } from "~/types/goals"
import type { Trade } from "~/types/trade"

function t(netPnl: number, entryTime: string): Trade {
  return {
    id: "t", userId: "u", accountId: "a1", tradeNumber: null,
    instrument: "NQ", direction: "long", contracts: 1,
    entryPrice: 1, exitPrice: 1, entryTime, exitTime: entryTime,
    pnl: netPnl, commission: 0, netPnl, mae: null, mfe: null, stopPrice: null,
    playbookId: null, session: null, notes: null, tags: null,
    followedRules: null, mistakes: null, createdAt: entryTime,
  }
}

const goals: Goals = { monthlyPnlTarget: 1000, winRateTarget: 0.5, maxDrawdownLimit: 500, minTradingDays: 3 }
const trades = [
  t(600,  "2026-06-10T15:00:00.000Z"),
  t(-200, "2026-06-10T16:00:00.000Z"),
  t(700,  "2026-06-11T15:00:00.000Z"),
]

describe("computeGoalsProgress", () => {
  it("tracks each configured goal for the month", () => {
    const p = computeGoalsProgress(goals, trades, "June 2026")

    expect(p.hasAnyGoal).toBe(true)
    expect(p.pnl).toMatchObject({ target: 1000, current: 1100, met: true })
    expect(p.pnl!.pct).toBe(1)                       // clamped
    expect(p.winRate!.met).toBe(true)                // 2/3 ≥ 0.5
    expect(p.drawdown).toMatchObject({ limit: 500, current: 200, breached: false })
    expect(p.tradingDays).toMatchObject({ target: 3, current: 2, met: false })
  })

  it("flags a breached drawdown limit", () => {
    const p = computeGoalsProgress({ ...goals, maxDrawdownLimit: 100 }, trades, "June 2026")
    expect(p.drawdown!.breached).toBe(true)
  })

  it("has no goals when nothing is set", () => {
    const p = computeGoalsProgress(
      { monthlyPnlTarget: null, winRateTarget: null, maxDrawdownLimit: null, minTradingDays: null },
      trades, "June 2026",
    )
    expect(p.hasAnyGoal).toBe(false)
    expect(p.pnl).toBeNull()
    expect(p.drawdown).toBeNull()
  })
})
