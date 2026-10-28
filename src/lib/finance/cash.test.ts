import { describe, it, expect } from "vitest"
import { quickCategories } from "./cash"

const cat = (id: string, sort: number, kind = "expense", archived = false) => ({ id, sort, kind, archived })

describe("quickCategories", () => {
  const categories = [
    cat("groceries", 0), cat("eating", 1), cat("transport", 2), cat("health", 3),
    cat("gifts", 4), cat("other", 5), cat("salary", 6, "income"), cat("old", 7, "expense", true),
  ]

  it("primero las más usadas y luego el resto en su orden", () => {
    expect(quickCategories(categories, ["gifts", "eating"], 4).map(c => c.id)).toEqual(["gifts", "eating", "groceries", "transport"])
  })

  it("solo gastos sin archivar, aunque se usen", () => {
    expect(quickCategories(categories, ["salary", "old", "health"], 2).map(c => c.id)).toEqual(["health", "groceries"])
  })
})
