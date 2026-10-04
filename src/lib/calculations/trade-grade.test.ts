import { describe, it, expect } from "vitest"
import { computeGrade, gradeForTrade, matchesGradeFilter } from "./trade-grade"
import { GRADE_SCALE } from "~/constants/grades"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import type { EntryCriterion } from "~/helpers/playbook-rules"

const crit = (id: string, required = false): EntryCriterion => ({ id, text: id, required })

// 1 required trigger + 3 confirmations.
const entry = [crit("trigger", true), crit("c1"), crit("c2"), crit("c3")]

describe("computeGrade — D/B/A scale (B = 2, A = 3)", () => {
  const min = { b: 2, a: 3 }
  const grade = (followed: string[] | null) => computeGrade(GRADE_SCALE, entry, min, followed)

  it("required + 3 confirmations → A", () => {
    expect(grade(["trigger", "c1", "c2", "c3"])).toBe("a")
  })
  it("required + 2 confirmations → B", () => {
    expect(grade(["trigger", "c1", "c3"])).toBe("b")
  })
  it("required + 1 confirmation → D", () => {
    expect(grade(["trigger", "c2"])).toBe("d")
  })
  it("missing required + 3 confirmations → D", () => {
    expect(grade(["c1", "c2", "c3"])).toBe("d")
  })
  it("playbook without required criteria, 3/3 → A", () => {
    const noRequired = [crit("c1"), crit("c2"), crit("c3")]
    expect(computeGrade(GRADE_SCALE, noRequired, min, ["c1", "c2", "c3"])).toBe("a")
  })
  it("trade without checklist → null", () => {
    expect(grade(null)).toBeNull()
  })

  it("an empty checklist is recorded → lowest grade, not null", () => {
    expect(grade([])).toBe("d")
  })
  it("a playbook without entry criteria → null", () => {
    expect(computeGrade(GRADE_SCALE, [], min, ["x"])).toBeNull()
  })
  it("ignores ticked ids that aren't entry criteria (exit rules, deleted criteria)", () => {
    expect(grade(["trigger", "c1", "exit-1", "deleted"])).toBe("d")
  })
  it("only required criteria and 0 thresholds → top grade when the trigger is met", () => {
    expect(computeGrade(GRADE_SCALE, [crit("trigger", true)], { b: 0, a: 0 }, ["trigger"])).toBe("a")
  })
})

describe("computeGrade — 4-grade scale D/C/B/A (C = 1, B = 2, A = 3)", () => {
  const scale = [
    { id: "d", label: "D", color: "" },
    { id: "c", label: "C", color: "" },
    { id: "b", label: "B", color: "" },
    { id: "a", label: "A", color: "" },
  ]
  const min = { c: 1, b: 2, a: 3 }

  it("required + 1 → C", () => {
    expect(computeGrade(scale, entry, min, ["trigger", "c1"])).toBe("c")
  })
  it("required + 0 → D", () => {
    expect(computeGrade(scale, entry, min, ["trigger"])).toBe("d")
  })
  it("required + 3 → A", () => {
    expect(computeGrade(scale, entry, min, ["trigger", "c1", "c2", "c3"])).toBe("a")
  })
})

describe("gradeForTrade", () => {
  const rules = parsePlaybookRules(JSON.stringify({
    version: 2,
    entry: [{ id: "t", text: "Trigger", required: true }, { id: "c1", text: "Conf", required: false }],
    gradeMin: { b: 0, a: 1 },
  }))
  const byId = new Map([["p1", rules]])

  it("is null without a playbook or for an unknown playbook", () => {
    expect(gradeForTrade({ playbookId: null, followedRules: ["t"] }, byId)).toBeNull()
    expect(gradeForTrade({ playbookId: "other", followedRules: ["t"] }, byId)).toBeNull()
  })
  it("grades through the trade's playbook", () => {
    expect(gradeForTrade({ playbookId: "p1", followedRules: ["t", "c1"] }, byId)).toBe("a")
    expect(gradeForTrade({ playbookId: "p1", followedRules: ["t"] }, byId)).toBe("b")
  })
})

describe("matchesGradeFilter", () => {
  it("'none' matches ungraded trades only", () => {
    expect(matchesGradeFilter(null, "none")).toBe(true)
    expect(matchesGradeFilter("d", "none")).toBe(false)
  })
  it("a grade id matches that grade only", () => {
    expect(matchesGradeFilter("a", "a")).toBe(true)
    expect(matchesGradeFilter("b", "a")).toBe(false)
    expect(matchesGradeFilter(null, "a")).toBe(false)
  })
})
