import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"
import { NYSE_HOLIDAY_LIST, isNyseBusinessDay, lastNyseBusinessDay, nextMonthlyClose } from "./invest-calendar"

describe("NYSE_HOLIDAY_LIST", () => {
  it("es la misma lista que la del job (market_calendar.py)", () => {
    const py = readFileSync(join(process.cwd(), "scripts/screener/screener/market_calendar.py"), "utf-8")
    // Solo el literal de la lista (los comentarios también llevan fechas).
    const start = py.indexOf('"""', py.indexOf("NYSE_HOLIDAYS: frozenset"))
    const block = py.slice(start, py.indexOf('"""', start + 3))
    const fromPython = [...block.matchAll(/\d{4}-\d{2}-\d{2}/g)].map(m => m[0]).sort()
    expect(NYSE_HOLIDAY_LIST).toEqual(fromPython)
  })
})

describe("lastNyseBusinessDay", () => {
  it("salta fines de semana y festivos de fin de mes", () => {
    expect(lastNyseBusinessDay("2026-10-28")).toBe("2026-10-30")   // 31 es sábado
    expect(lastNyseBusinessDay("2027-05-03")).toBe("2027-05-28")   // 31 es Memorial Day
    expect(lastNyseBusinessDay("2026-12-01")).toBe("2026-12-31")
  })

  it("un año fuera de la lista lanza error", () => {
    expect(() => isNyseBusinessDay("2031-01-02")).toThrow("NYSE_HOLIDAYS")
  })
})

describe("nextMonthlyClose", () => {
  it("el cierre del mes en curso, incluido el propio día", () => {
    expect(nextMonthlyClose("2026-10-28")).toBe("2026-10-30")
    expect(nextMonthlyClose("2026-10-30")).toBe("2026-10-30")
  })

  it("si ya pasó (fin de semana tras el cierre), el del mes siguiente", () => {
    expect(nextMonthlyClose("2026-10-31")).toBe("2026-11-30")
    expect(nextMonthlyClose("2026-12-31")).toBe("2026-12-31")
  })
})
