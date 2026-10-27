import { describe, it, expect } from "vitest"
import { MODULE_HOME, getActiveModule, parseModule } from "./active-module"

describe("getActiveModule", () => {
  it.each([
    ["/invest", "invest"],
    ["/invest/positions", "invest"],
    ["/invest/performance", "invest"],
    ["/money", "money"],
    ["/money/anything", "money"],
    ["/dashboard", "trading"],
    ["/trades/abc", "trading"],
    ["/journal", "trading"],
    ["/settings", "trading"],
    ["/", "trading"],
  ] as const)("%s → %s", (pathname, module) => {
    expect(getActiveModule(pathname)).toBe(module)
  })

  it("un prefijo parecido no es el módulo", () => {
    expect(getActiveModule("/investors")).toBe("trading")
    expect(getActiveModule("/moneyball")).toBe("trading")
  })
})

describe("parseModule", () => {
  it("acepta solo módulos válidos", () => {
    expect(parseModule("invest")).toBe("invest")
    expect(parseModule("money")).toBe("money")
    expect(parseModule("trading")).toBe("trading")
    expect(parseModule("other")).toBeNull()
    expect(parseModule(null)).toBeNull()
  })
})

describe("MODULE_HOME", () => {
  it("cada home pertenece a su módulo", () => {
    for (const [module, home] of Object.entries(MODULE_HOME)) {
      expect(getActiveModule(home)).toBe(module)
    }
  })
})
