import { describe, it, expect } from "vitest"
import { computeMistakeStats } from "./mistakes"
import type { Trade } from "~/types/trade"

function trade(netPnl: number, mistakes: string[] | null): Trade {
  return {
    id: "t", userId: "u", accountId: "a1", tradeNumber: null,
    instrument: "NQ", direction: "long", contracts: 1,
    entryPrice: 1, exitPrice: 1,
    entryTime: "2026-06-10T15:00:00.000Z", exitTime: "2026-06-10T15:30:00.000Z",
    pnl: netPnl, commission: 0, netPnl, mae: null, mfe: null, stopPrice: null,
    playbookId: null, session: null, notes: null, tags: null,
    followedRules: null, mistakes, createdAt: "2026-06-10T15:30:00.000Z",
  }
}

describe("computeMistakeStats", () => {
  it("aggregates per mistake (a trade counts in each of its mistakes)", () => {
    const rows = computeMistakeStats([
      trade(-300, ["Revenge trade", "Oversized"]),
      trade(-100, ["Revenge trade"]),
      trade(200,  ["Oversized"]),
      trade(50,   null),
    ])
    const revenge  = rows.find(r => r.label === "Revenge trade")!
    const oversize = rows.find(r => r.label === "Oversized")!

    expect(revenge).toMatchObject({ trades: 2, netPnl: -400, avgPnl: -200, winRate: 0 })
    expect(oversize).toMatchObject({ trades: 2, netPnl: -100, avgPnl: -50, winRate: 0.5 })
  })

  it("sorts most-costly (most negative net P&L) first", () => {
    const rows = computeMistakeStats([
      trade(-500, ["Big"]),
      trade(-50,  ["Small"]),
    ])
    expect(rows.map(r => r.label)).toEqual(["Big", "Small"])
  })

  it("returns an empty array when no trade has mistakes", () => {
    expect(computeMistakeStats([trade(100, null), trade(-50, [])])).toEqual([])
  })
})
