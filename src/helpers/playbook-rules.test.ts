import { describe, it, expect } from "vitest"
import { parsePlaybookRules } from "./playbook-rules"

describe("parsePlaybookRules", () => {
  it("returns empty groups for null or non-structured input", () => {
    expect(parsePlaybookRules(null).all).toEqual([])
    expect(parsePlaybookRules("just some free text").all).toEqual([])
    expect(parsePlaybookRules("{not json").all).toEqual([])
  })

  it("parses groups and flattens `all`", () => {
    const r = parsePlaybookRules(JSON.stringify({ entry: ["a", "b"], exit: ["x"], conditions: [] }))
    expect(r.entry).toEqual(["a", "b"])
    expect(r.exit).toEqual(["x"])
    expect(r.all).toEqual(["a", "b", "x"])
  })

  it("defaults min to the full group length when not configured", () => {
    const r = parsePlaybookRules(JSON.stringify({ entry: ["a", "b", "c"], exit: ["x"] }))
    expect(r.min).toEqual({ entry: 3, exit: 1, conditions: 0 })
  })

  it("honours and clamps a configured min to [0, length]", () => {
    const r = parsePlaybookRules(JSON.stringify({
      entry: ["a", "b", "c"], exit: ["x", "y"], conditions: [],
      min: { entry: 2, exit: 9, conditions: 0 },
    }))
    expect(r.min.entry).toBe(2)
    expect(r.min.exit).toBe(2)   // clamped from 9 to 2
    expect(r.min.conditions).toBe(0)
  })
})
