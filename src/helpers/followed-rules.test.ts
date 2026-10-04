import { describe, it, expect } from "vitest"
import { toggleFollowed } from "./followed-rules"

describe("toggleFollowed", () => {
  it("ticks a criterion, starting from no checklist", () => {
    expect(toggleFollowed(null, "a")).toEqual(["a"])
    expect(toggleFollowed(["a"], "b")).toEqual(["a", "b"])
  })

  it("un-ticks a criterion", () => {
    expect(toggleFollowed(["a", "b"], "a")).toEqual(["b"])
  })

  it("un-ticking the last criterion yields [] (recorded, nothing met), not null", () => {
    expect(toggleFollowed(["a"], "a")).toEqual([])
  })
})
