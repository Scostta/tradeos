import { describe, it, expect } from "vitest"
import { defaultManualAccount, quickCategories } from "./cash"

const cat = (id: string, sort: number, kind = "expense", archived = false) => ({ id, sort, kind, archived })

describe("quickCategories", () => {
  const categories = [
    cat("groceries", 0), cat("eating", 1), cat("transport", 2), cat("health", 3),
    cat("gifts", 4), cat("other", 5), cat("salary", 6, "income"), cat("old", 7, "expense", true),
    cat("other-income", 8, "income"), cat("transfer", 9, "transfer"),
  ]

  it("primero las más usadas y luego el resto en su orden", () => {
    expect(quickCategories(categories, ["gifts", "eating"], 4).map(c => c.id)).toEqual(["gifts", "eating", "groceries", "transport"])
  })

  it("solo gastos sin archivar, aunque se usen", () => {
    expect(quickCategories(categories, ["salary", "old", "health"], 2).map(c => c.id)).toEqual(["health", "groceries"])
  })

  it("con kind income solo salen ingresos", () => {
    expect(quickCategories(categories, ["groceries", "other-income"], 5, "income").map(c => c.id)).toEqual(["other-income", "salary"])
  })
})

describe("defaultManualAccount", () => {
  const acc = (id: string, kind: string, active = true) => ({ id, kind, active })
  const accounts = [acc("main", "checking"), acc("cash", "cash"), acc("savings", "savings"), acc("old", "checking", false)]

  it("un gasto va a Cash", () => {
    expect(defaultManualAccount(accounts, "expense", "main")?.id).toBe("cash")
  })

  it("un ingreso va a la cuenta por defecto", () => {
    expect(defaultManualAccount(accounts, "income", "savings")?.id).toBe("savings")
  })

  it("sin cuenta por defecto válida, un ingreso va a la primera activa que no es Cash", () => {
    expect(defaultManualAccount(accounts, "income", "old")?.id).toBe("main")
    expect(defaultManualAccount(accounts, "income", null)?.id).toBe("main")
  })

  it("si solo está Cash, todo va a Cash; sin cuentas, null", () => {
    expect(defaultManualAccount([acc("cash", "cash")], "income", null)?.id).toBe("cash")
    expect(defaultManualAccount([], "expense", null)).toBeNull()
  })
})
