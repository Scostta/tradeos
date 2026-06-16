import { describe, it, expect } from "vitest"
import { computeAdherence } from "./playbook-adherence"
import type { Trade } from "~/types/trade"

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t", userId: "u", accountId: "a1", tradeNumber: null,
    instrument: "NQ", direction: "long", contracts: 1,
    entryPrice: 19850, exitPrice: 19850,
    entryTime: "2026-06-10T15:00:00.000Z", exitTime: "2026-06-10T15:30:00.000Z",
    pnl: 0, commission: 0, netPnl: 0, mae: null, mfe: null, stopPrice: null,
    playbookId: "p1", session: null, notes: null, tags: null, followedRules: null,
    createdAt: "2026-06-10T15:30:00.000Z", ...over,
  }
}

describe("computeAdherence", () => {
  const rules = ["A", "B"]

  it("splits tracked trades into followed-all vs broke", () => {
    const trades = [
      trade({ netPnl: 1000, followedRules: ["A", "B"] }),  // followed
      trade({ netPnl: 600,  followedRules: ["B", "A"] }),  // followed (order-independent)
      trade({ netPnl: -500, followedRules: ["A"] }),       // broke (missing B)
      trade({ netPnl: 200,  followedRules: null }),        // untracked — excluded
    ]
    const a = computeAdherence(rules, trades)!

    expect(a.totalRules).toBe(2)
    expect(a.tracked).toBe(3)
    expect(a.followed.count).toBe(2)
    expect(a.followed.netPnl).toBe(1600)
    expect(a.followed.winRate).toBe(1)
    expect(a.broke.count).toBe(1)
    expect(a.broke.netPnl).toBe(-500)
    expect(a.broke.winRate).toBe(0)
  })

  it("returns null when the playbook has no rules", () => {
    expect(computeAdherence([], [trade({ followedRules: [] })])).toBeNull()
  })

  it("treats an empty followed-rules array as tracked-but-broke", () => {
    const a = computeAdherence(rules, [trade({ followedRules: [] })])!
    expect(a.tracked).toBe(1)
    expect(a.broke.count).toBe(1)
    expect(a.followed.count).toBe(0)
  })
})
