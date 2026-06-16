import { describe, it, expect } from "vitest"
import { computePlaybookStats } from "./playbook-stats"
import type { Playbook } from "~/types/playbook"
import type { Trade } from "~/types/trade"

function strat(id: string, name: string): Playbook {
  return {
    id, userId: "u", name, description: null, rules: null, active: true,
    createdAt: "2026-06-10T00:00:00.000Z",
  }
}

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t", userId: "u", accountId: "a1", tradeNumber: null,
    instrument: "NQ", direction: "long", contracts: 1,
    entryPrice: 19850, exitPrice: 19850,
    entryTime: "2026-06-10T15:00:00.000Z", exitTime: "2026-06-10T15:30:00.000Z",
    pnl: 0, commission: 0, netPnl: 0, mae: null, mfe: null, stopPrice: null,
    playbookId: "s1", session: null, notes: null, tags: null, followedRules: null,
    createdAt: "2026-06-10T15:30:00.000Z", ...over,
  }
}

describe("computePlaybookStats", () => {
  it("aggregates per-playbook stats including R via the account risk fallback", () => {
    const playbooks = [strat("s1", "Breakout"), strat("s2", "Fade")]
    const trades = [
      trade({ netPnl: 1000 }),                       // s1, R = +2 (risk 500)
      trade({ netPnl: -500 }),                       // s1, R = −1
      trade({ netPnl: 999, playbookId: null }),      // unassigned — ignored
    ]
    const risk = new Map<string, number | null>([["a1", 500]])

    const [s1, s2] = computePlaybookStats(playbooks, trades, risk)

    expect(s1!.tradeCount).toBe(2)
    expect(s1!.netPnl).toBe(500)
    expect(s1!.winRate).toBe(0.5)
    expect(s1!.profitFactor).toBe(2)        // 1000 / 500
    expect(s1!.avgWin).toBe(1000)
    expect(s1!.avgLoss).toBe(-500)
    expect(s1!.expectancyR).toBe(0.5)       // (+2 −1) / 2
    expect(s1!.rCoverage).toEqual({ withR: 2, total: 2 })

    expect(s2!.tradeCount).toBe(0)
    expect(s2!.expectancyR).toBe(0)
    expect(s2!.rCoverage).toEqual({ withR: 0, total: 0 })
  })

  it("prefers a trade's own stop over the account fallback for R", () => {
    // stop → risk |19850−19800|×20×1 = 1000 → R = 1 (fallback 500 would give 2)
    const [s1] = computePlaybookStats(
      [strat("s1", "Breakout")],
      [trade({ netPnl: 1000, stopPrice: 19800 })],
      new Map([["a1", 500]]),
    )
    expect(s1!.expectancyR).toBe(1)
  })
})
