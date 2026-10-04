import { describe, it, expect } from "vitest"
import { parseTradeFilters } from "./trade-filters"

describe("parseTradeFilters — grade", () => {
  it("accepts grade ids and 'none'", () => {
    expect(parseTradeFilters({ grade: "a" }).grade).toBe("a")
    expect(parseTradeFilters({ grade: "d" }).grade).toBe("d")
    expect(parseTradeFilters({ grade: "none" }).grade).toBe("none")
  })

  it("ignores missing or unknown grades", () => {
    expect(parseTradeFilters({}).grade).toBeNull()
    expect(parseTradeFilters({ grade: "z" }).grade).toBeNull()
    expect(parseTradeFilters({ grade: "A" }).grade).toBeNull()
  })
})
