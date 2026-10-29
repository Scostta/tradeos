import { describe, it, expect } from "vitest"
import { isReviewed } from "./trade-review"

describe("isReviewed", () => {
  const base = { reviewedAt: null, playbookId: null, followedRules: null }

  it("a trade saved in /review is reviewed even without playbook", () => {
    expect(isReviewed({ ...base, reviewedAt: "2026-10-29T20:00:00Z" })).toBe(true)
  })

  it("a playbook with its checklist (graded elsewhere) counts as reviewed", () => {
    expect(isReviewed({ ...base, playbookId: "p", followedRules: [] })).toBe(true)
  })

  it("an untouched trade, or a playbook without checklist, is pending", () => {
    expect(isReviewed(base)).toBe(false)
    expect(isReviewed({ ...base, playbookId: "p" })).toBe(false)
  })
})
