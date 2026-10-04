import { describe, it, expect } from "vitest"
import { computeGradeReport } from "./grade-report"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import type { Trade } from "~/types/trade"

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t", userId: "u", accountId: "a1", tradeNumber: null,
    instrument: "ES", direction: "long", contracts: 1,
    entryPrice: 5000, exitPrice: 5000,
    entryTime: "2026-10-01T15:00:00.000Z", exitTime: "2026-10-01T15:30:00.000Z",
    pnl: 0, commission: 0, netPnl: 0, mae: null, mfe: null, stopPrice: 4990,
    playbookId: null, session: null, notes: null, tags: null, followedRules: null, mistakes: null,
    createdAt: "2026-10-01T15:30:00.000Z", ...over,
  }
}

// p1: trigger required + 2 confirmations (B = 1, A = 2). p2: only exit criteria.
const rulesByPlaybook = new Map([
  ["p1", parsePlaybookRules(JSON.stringify({
    version: 2,
    entry: [
      { id: "t", text: "Trigger", required: true },
      { id: "c1", text: "C1", required: false },
      { id: "c2", text: "C2", required: false },
    ],
    gradeMin: { b: 1, a: 2 },
  }))],
  ["p2", parsePlaybookRules(JSON.stringify({ version: 2, exit: [{ id: "x", text: "X" }] }))],
])

const trades = [
  trade({ id: "1", playbookId: "p1", followedRules: ["t", "c1", "c2"], netPnl: 200 }),                               // A
  trade({ id: "2", playbookId: "p1", followedRules: ["t", "c1"], netPnl: -50 }),                                     // B
  trade({ id: "3", playbookId: "p1", followedRules: ["c1", "c2"], netPnl: -100,
          entryTime: "2026-09-15T15:00:00.000Z" }),                                                                  // D (Sep)
  trade({ id: "4", playbookId: "p1", followedRules: null, netPnl: 30 }),                                             // no checklist
  trade({ id: "5", playbookId: "p2", followedRules: ["x"], netPnl: 10 }),                                            // no entry criteria
  trade({ id: "6", playbookId: null, netPnl: 5 }),                                                                   // no playbook
]

describe("computeGradeReport", () => {
  const r = computeGradeReport(rulesByPlaybook, trades)

  it("splits coverage into graded / no checklist / not gradeable", () => {
    expect(r.coverage).toEqual({ total: 6, noPlaybook: 2, noChecklist: 1, graded: 3 })
  })

  it("groups every trade by grade, best first, ungraded last", () => {
    expect(r.groups.map(g => [g.grade, g.count])).toEqual([["a", 1], ["b", 1], ["d", 1], [null, 3]])
    expect(r.groups[0]!.netPnl).toBe(200)
    expect(r.groups[3]!.netPnl).toBe(45)
  })

  it("builds a chronological monthly grade mix", () => {
    expect(r.months.map(m => m.label)).toEqual(["Sep 2026", "Oct 2026"])
    expect(r.months[0]).toMatchObject({ key: "2026-09", counts: { a: 0, b: 0, d: 1 }, graded: 1, total: 1 })
    expect(r.months[1]).toMatchObject({ key: "2026-10", counts: { a: 1, b: 1, d: 0 }, graded: 2, total: 5 })
  })

  it("buckets months in the user's timezone", () => {
    // 2026-10-01 03:00 UTC is still Sep 30 in New York.
    const r2 = computeGradeReport(rulesByPlaybook, [
      trade({ playbookId: "p1", followedRules: ["t"], entryTime: "2026-10-01T03:00:00.000Z" }),
    ], new Map(), "America/New_York")
    expect(r2.months.map(m => m.key)).toEqual(["2026-09"])
  })

  it("is empty for no trades", () => {
    const e = computeGradeReport(rulesByPlaybook, [])
    expect(e.coverage).toEqual({ total: 0, noPlaybook: 0, noChecklist: 0, graded: 0 })
    expect(e.months).toEqual([])
    expect(e.groups.every(g => g.count === 0)).toBe(true)
  })
})
