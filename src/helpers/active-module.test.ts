import { describe, it, expect } from "vitest"
import { MODULE_HOME, getActiveModule, getRouteModule, parseModule } from "./active-module"

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
    ["/", "trading"],
  ] as const)("%s → %s", (pathname, module) => {
    expect(getActiveModule(pathname)).toBe(module)
    expect(getRouteModule(pathname)).toBe(module)
  })

  it("las rutas compartidas muestran el último módulo visitado", () => {
    expect(getRouteModule("/settings")).toBeNull()
    expect(getRouteModule("/settings/anything")).toBeNull()
    expect(getActiveModule("/settings", "invest")).toBe("invest")
    expect(getActiveModule("/settings")).toBe("trading")
    // Una ruta de módulo manda sobre el último visitado.
    expect(getActiveModule("/invest", "money")).toBe("invest")
    expect(getActiveModule("/dashboard", "invest")).toBe("trading")
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
    expect(parseModule(undefined)).toBeNull()
  })
})

describe("MODULE_HOME", () => {
  it("cada home pertenece a su módulo", () => {
    for (const [module, home] of Object.entries(MODULE_HOME)) {
      expect(getActiveModule(home)).toBe(module)
    }
  })
})
