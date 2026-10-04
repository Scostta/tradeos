import { describe, it, expect } from "vitest"
import { computeAdherence, computeGradeBreakdown } from "./playbook-adherence"
import type { Trade } from "~/types/trade"
import { legacyGradeMin } from "~/helpers/playbook-rules"
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

// v1-style rules (criterion id = text): `min.entry` becomes the grade thresholds
// exactly as the migration derives them.
function rules(
  entry: string[], exit: string[], conditions: string[],
  min: { entry: number; exit: number; conditions: number },
): ParsedRules {
  const c = (t: string) => ({ id: t, text: t })
  const e = entry.map(t => ({ ...c(t), required: false }))
  const x = exit.map(c), k = conditions.map(c)
  return {
    entry: e, exit: x, conditions: k, all: [...e, ...x, ...k],
    min: { exit: min.exit, conditions: min.conditions },
    gradeMin: legacyGradeMin(entry.length, min.entry),
  }
}

describe("computeAdherence — entry grade + exit/conditions minimums", () => {
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

describe("computeAdherence — required criteria", () => {
  const r: ParsedRules = {
    ...rules(["T", "C1", "C2"], ["X"], [], { entry: 0, exit: 1, conditions: 0 }),
    entry: [{ id: "T", text: "T", required: true }, { id: "C1", text: "C1", required: false }, { id: "C2", text: "C2", required: false }],
    gradeMin: { b: 1, a: 2 },
  }

  it("missing the required trigger breaks the setup even with every confirmation", () => {
    const a = computeAdherence(r, [trade({ followedRules: ["C1", "C2", "X"] })])!
    expect(a.broke.count).toBe(1)
  })

  it("a graded entry still needs the exit minimum", () => {
    const a = computeAdherence(r, [
      trade({ followedRules: ["T", "C1", "X"] }),   // B + exit → followed
      trade({ followedRules: ["T", "C1", "C2"] }),  // A, exit 0/1 → broke
    ])!
    expect(a.followed.count).toBe(1)
    expect(a.broke.count).toBe(1)
  })
})

describe("computeGradeBreakdown", () => {
  // Entry 4 criteria, legacy "require 4 of 4" → B = 3, A = 4.
  const r = rules(["a", "b", "c", "d"], [], [], { entry: 4, exit: 0, conditions: 0 })

  it("groups trades per grade, best first, with ungraded last", () => {
    const groups = computeGradeBreakdown(r, [
      trade({ netPnl: 300,  followedRules: ["a", "b", "c", "d"] }),  // A
      trade({ netPnl: 100,  followedRules: ["a", "b", "c"] }),       // B
      trade({ netPnl: -50,  followedRules: ["b", "c", "d"] }),       // B
      trade({ netPnl: -200, followedRules: ["a"] }),                 // D
      trade({ netPnl: 40,   followedRules: null }),                  // ungraded
    ])

    expect(groups.map(g => g.grade)).toEqual(["a", "b", "d", null])
    expect(groups.map(g => g.count)).toEqual([1, 2, 1, 1])
    expect(groups[1]!.netPnl).toBe(50)
    expect(groups[1]!.winRate).toBe(0.5)
    expect(groups[2]!.netPnl).toBe(-200)
  })

  it("returns empty groups for every grade when there are no trades", () => {
    const groups = computeGradeBreakdown(r, [])
    expect(groups).toHaveLength(4)
    expect(groups.every(g => g.count === 0)).toBe(true)
  })
})
