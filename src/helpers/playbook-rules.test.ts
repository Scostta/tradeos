import { describe, it, expect } from "vitest"
import {
  parsePlaybookRules, serializePlaybookRules, normalizeGradeMin, setGradeMin,
  legacyGradeMin, withEntry, EMPTY_RULES,
} from "./playbook-rules"
import type { EntryCriterion, PlaybookRules } from "./playbook-rules"

const crit = (id: string, required = false): EntryCriterion => ({ id, text: `text ${id}`, required })

describe("parsePlaybookRules — v2", () => {
  it("returns empty groups for null or non-structured input", () => {
    expect(parsePlaybookRules(null).all).toEqual([])
    expect(parsePlaybookRules("just some free text").all).toEqual([])
    expect(parsePlaybookRules("{not json").all).toEqual([])
  })

  it("parses criteria with ids, required flags, minimums and thresholds", () => {
    const r = parsePlaybookRules(JSON.stringify({
      version: 2,
      entry: [{ id: "e1", text: "Trigger", required: true }, { id: "e2", text: "Conf", required: false }],
      exit:  [{ id: "x1", text: "Target" }],
      min:   { exit: 1, conditions: 0 },
      gradeMin: { b: 0, a: 1 },
    }))
    expect(r.entry).toEqual([
      { id: "e1", text: "Trigger", required: true },
      { id: "e2", text: "Conf", required: false },
    ])
    expect(r.exit).toEqual([{ id: "x1", text: "Target" }])
    expect(r.all.map(c => c.id)).toEqual(["e1", "e2", "x1"])
    expect(r.min).toEqual({ exit: 1, conditions: 0 })
    expect(r.gradeMin).toEqual({ b: 0, a: 1 })
  })

  it("repairs invalid stored thresholds (too high / decreasing)", () => {
    const r = parsePlaybookRules(JSON.stringify({
      version: 2,
      entry: [crit("a"), crit("b")],
      gradeMin: { b: 2, a: 9 },
    }))
    expect(r.gradeMin).toEqual({ b: 2, a: 2 })
  })
})

describe("parsePlaybookRules — v1 compatibility", () => {
  it("uses the text as id and derives thresholds from `require N of M`", () => {
    const r = parsePlaybookRules(JSON.stringify({
      entry: ["a", "b", "c", "d"], exit: ["x"], conditions: [],
      min: { entry: 4, exit: 1, conditions: 0 },
    }))
    expect(r.entry).toEqual([
      { id: "a", text: "a", required: false }, { id: "b", text: "b", required: false },
      { id: "c", text: "c", required: false }, { id: "d", text: "d", required: false },
    ])
    expect(r.gradeMin).toEqual({ b: 3, a: 4 })
    expect(r.min).toEqual({ exit: 1, conditions: 0 })
  })

  it("defaults min to the full group length when not configured", () => {
    const r = parsePlaybookRules(JSON.stringify({ entry: ["a", "b", "c"], exit: ["x"] }))
    expect(r.min).toEqual({ exit: 1, conditions: 0 })
    expect(r.gradeMin).toEqual({ b: 2, a: 3 })
  })
})

describe("legacyGradeMin (mirrors the SQL migration)", () => {
  it("A = total; B = N when N < total", () => {
    expect(legacyGradeMin(4, 2)).toEqual({ b: 2, a: 4 })
    expect(legacyGradeMin(4, 0)).toEqual({ b: 0, a: 4 })
  })
  it("B = total − 1 when N = total, minimum 1", () => {
    expect(legacyGradeMin(4, 4)).toEqual({ b: 3, a: 4 })
    expect(legacyGradeMin(1, 1)).toEqual({ b: 1, a: 1 })
  })
  it("every threshold is 0 without confirmations", () => {
    expect(legacyGradeMin(0, 0)).toEqual({ b: 0, a: 0 })
  })
})

describe("grade thresholds", () => {
  it("normalizeGradeMin clamps to confirmations and keeps them non-decreasing", () => {
    expect(normalizeGradeMin({ b: 3, a: 1 }, 5)).toEqual({ b: 3, a: 3 })
    expect(normalizeGradeMin({ b: -1, a: 7 }, 3)).toEqual({ b: 0, a: 3 })
    expect(normalizeGradeMin({}, 2)).toEqual({ b: 2, a: 2 })
  })

  it("setGradeMin raises higher grades and lowers lower ones", () => {
    expect(setGradeMin({ b: 1, a: 2 }, "b", 3, 4)).toEqual({ b: 3, a: 3 })
    expect(setGradeMin({ b: 2, a: 3 }, "a", 1, 4)).toEqual({ b: 1, a: 1 })
    expect(setGradeMin({ b: 1, a: 2 }, "a", 9, 3)).toEqual({ b: 1, a: 3 })
  })

  it("marking a criterion required clips thresholds above the new maximum", () => {
    // 4 confirmations, B = 3, A = 4 → mark one required → 3 confirmations.
    const rules: PlaybookRules = {
      ...EMPTY_RULES,
      entry: [crit("a"), crit("b"), crit("c"), crit("d")],
      gradeMin: { b: 3, a: 4 },
    }
    const next = withEntry(rules, rules.entry.map(c => c.id === "a" ? { ...c, required: true } : c))
    expect(next.gradeMin).toEqual({ b: 3, a: 3 })

    // Mark two more required → 1 confirmation: both clip to 1, still non-decreasing.
    const next2 = withEntry(next, next.entry.map(c => c.id === "b" || c.id === "c" ? { ...c, required: true } : c))
    expect(next2.gradeMin).toEqual({ b: 1, a: 1 })
  })

  it("thresholds within the new maximum are left untouched", () => {
    const rules: PlaybookRules = { ...EMPTY_RULES, entry: [crit("a"), crit("b"), crit("c")], gradeMin: { b: 1, a: 2 } }
    const next = withEntry(rules, rules.entry.map(c => c.id === "a" ? { ...c, required: true } : c))
    expect(next.gradeMin).toEqual({ b: 1, a: 2 })
  })
})

describe("serializePlaybookRules", () => {
  it("round-trips through parse and drops blank criteria", () => {
    const rules: PlaybookRules = {
      entry:      [crit("e1", true), crit("e2"), { id: "blank", text: "  ", required: false }],
      exit:       [{ id: "x1", text: "Target" }],
      conditions: [],
      min:        { exit: 1, conditions: 0 },
      gradeMin:   { b: 1, a: 1 },
    }
    const raw = serializePlaybookRules(rules)!
    const parsed = parsePlaybookRules(raw)
    expect(JSON.parse(raw).version).toBe(2)
    expect(parsed.entry).toEqual([crit("e1", true), crit("e2")])
    expect(parsed.exit).toEqual(rules.exit)
    expect(parsed.min).toEqual(rules.min)
    expect(parsed.gradeMin).toEqual({ b: 1, a: 1 })
  })

  it("returns null when every group is empty", () => {
    expect(serializePlaybookRules({ ...EMPTY_RULES, entry: [{ id: "x", text: "", required: false }] })).toBeNull()
  })
})
