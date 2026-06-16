import { describe, it, expect } from "vitest"
import { computeAdherence } from "./playbook-adherence"
import type { Trade } from "~/types/trade"
import type { ParsedRules } from "~/helpers/playbook-rules"

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t", userId: "u", accountId: "a1", tradeNumber: null,
    instrument: "NQ", direction: "long", contracts: 1,
    entryPrice: 19850, exitPrice: 19850,
    entryTime: "2026-06-10T15:00:00.000Z", exitTime: "2026-06-10T15:30:00.000Z",
    pnl: 0, commission: 0, netPnl: 0, mae: null, mfe: null, stopPrice: null,
    playbookId: "p1", session: null, notes: null, tags: null, followedRules: null, mistakes: null,
    createdAt: "2026-06-10T15:30:00.000Z", ...over,
  }
}

function rules(
  entry: string[], exit: string[], conditions: string[],
  min: { entry: number; exit: number; conditions: number },
): ParsedRules {
  return { entry, exit, conditions, all: [...entry, ...exit, ...conditions], min }
}

describe("computeAdherence — per-group minimums", () => {
  // Entry: need 2 of 3; Exit: need 1 of 2.
  const r = rules(["A", "B", "C"], ["X", "Y"], [], { entry: 2, exit: 1, conditions: 0 })

  it("counts a trade as followed when every group meets its minimum", () => {
    const trades = [
      trade({ netPnl: 1000, followedRules: ["A", "B", "X"] }),  // entry 2/3, exit 1/2 → valid
      trade({ netPnl: -500, followedRules: ["A", "X"] }),        // entry 1/3 < 2 → broke
      trade({ netPnl: 200,  followedRules: null }),              // untracked
    ]
    const a = computeAdherence(r, trades)!

    expect(a.tracked).toBe(2)
    expect(a.followed.count).toBe(1)
    expect(a.followed.netPnl).toBe(1000)
    expect(a.broke.count).toBe(1)
    expect(a.broke.netPnl).toBe(-500)
  })

  it("a low exit minimum (1 of 2) validates with a single exit rule", () => {
    const a = computeAdherence(r, [trade({ followedRules: ["A", "B", "Y"] })])!
    expect(a.followed.count).toBe(1)
    expect(a.broke.count).toBe(0)
  })

  it("returns null when the playbook has no rules", () => {
    expect(computeAdherence(rules([], [], [], { entry: 0, exit: 0, conditions: 0 }), [trade({ followedRules: [] })])).toBeNull()
  })

  it("an empty followed-rules array is tracked but broke when a minimum is required", () => {
    const r2 = rules(["A"], [], [], { entry: 1, exit: 0, conditions: 0 })
    const a = computeAdherence(r2, [trade({ followedRules: [] })])!
    expect(a.tracked).toBe(1)
    expect(a.broke.count).toBe(1)
    expect(a.followed.count).toBe(0)
  })
})
