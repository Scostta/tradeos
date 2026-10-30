import { describe, it, expect } from "vitest"
import { isManualMatch, matchManualTransactions } from "./manual-match"

const row = (importKey: string, bookedAt: string, amount: number) => ({ importKey, bookedAt, amount })
const manual = (id: string, bookedAt: string, amount: number) => ({ id, bookedAt, amount })

describe("isManualMatch", () => {
  it("mismo importe al céntimo y fecha dentro de ±3 días", () => {
    expect(isManualMatch(row("a", "2026-10-28", -14), manual("m", "2026-10-25", -14.0))).toBe(true)
    expect(isManualMatch(row("a", "2026-10-29", -14), manual("m", "2026-10-25", -14))).toBe(false)
    expect(isManualMatch(row("a", "2026-10-28", -14.01), manual("m", "2026-10-28", -14))).toBe(false)
  })

  it("el signo cuenta: un ingreso no empareja con un gasto", () => {
    expect(isManualMatch(row("a", "2026-10-28", 14), manual("m", "2026-10-28", -14))).toBe(false)
  })

  it("cruza meses", () => {
    expect(isManualMatch(row("a", "2026-11-01", -5), manual("m", "2026-10-30", -5))).toBe(true)
  })
})

describe("matchManualTransactions", () => {
  it("cada manual se usa una vez y gana la fecha más cercana", () => {
    const rows = [row("r1", "2026-10-27", -3.5), row("r2", "2026-10-28", -3.5)]
    const manuals = [manual("m28", "2026-10-28", -3.5), manual("m27", "2026-10-27", -3.5)]
    expect(Object.fromEntries(matchManualTransactions(rows, manuals))).toEqual({ r1: "m27", r2: "m28" })
  })

  it("más filas que manuales: sobran filas sin pareja", () => {
    const rows = [row("r1", "2026-10-28", -10), row("r2", "2026-10-28", -10)]
    const out = matchManualTransactions(rows, [manual("m", "2026-10-28", -10)])
    expect(out.size).toBe(1)
    expect(out.get("r1")).toBe("m")
  })

  it("sin importe igual no hay pareja", () => {
    expect(matchManualTransactions([row("r", "2026-10-28", -10)], [manual("m", "2026-10-28", -11)]).size).toBe(0)
  })
})
