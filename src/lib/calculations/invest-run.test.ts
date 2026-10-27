import { describe, it, expect } from "vitest"
import { distanceToSma, isCurrentMonthRun, openBlockers } from "./invest-run"

describe("isCurrentMonthRun", () => {
  it("el run de octubre evalúa el cierre de septiembre", () => {
    expect(isCurrentMonthRun("2026-09-30", "2026-10-01")).toBe(true)
    expect(isCurrentMonthRun("2026-09-30", "2026-10-31")).toBe(true)
  })

  it("en noviembre el run de septiembre ya no vale", () => {
    expect(isCurrentMonthRun("2026-09-30", "2026-11-02")).toBe(false)
  })

  it("cruza el año", () => {
    expect(isCurrentMonthRun("2026-12-31", "2027-01-04")).toBe(true)
  })
})

describe("distanceToSma", () => {
  it("precio sobre la media", () => {
    expect(distanceToSma(110, 100)).toBeCloseTo(0.1, 12)
    expect(distanceToSma(90, 100)).toBeCloseTo(-0.1, 12)
  })

  it("null si falta un dato", () => {
    expect(distanceToSma(null, 100)).toBeNull()
    expect(distanceToSma(100, null)).toBeNull()
  })
})

describe("openBlockers", () => {
  const base = {
    isCurrentRun:  true,
    candidate:     { ticker: "MU", passes: true, sector: "Technology" },
    openPositions: [] as { ticker: string; sector: string | null }[],
    maxPositions:  5,
  }

  it("sin bloqueos", () => {
    expect(openBlockers(base)).toEqual([])
  })

  it("sin run del mes o ticker no aprobado", () => {
    expect(openBlockers({ ...base, isCurrentRun: false })).toEqual(["NO_CURRENT_RUN"])
    expect(openBlockers({ ...base, candidate: { ...base.candidate, passes: false } })).toEqual(["NOT_APPROVED"])
  })

  it("nunca se promedia: ticker ya abierto", () => {
    const open = [{ ticker: "MU", sector: "Technology" }]
    expect(openBlockers({ ...base, openPositions: open })).toEqual(["ALREADY_OPEN"])
  })

  it("bloquea la 6ª posición", () => {
    const open = ["A", "B", "C", "D", "E"].map((ticker, i) => ({ ticker, sector: `S${i}` }))
    expect(openBlockers({ ...base, openPositions: open })).toEqual(["MAX_POSITIONS"])
    expect(openBlockers({ ...base, openPositions: open.slice(0, 4) })).toEqual([])
  })

  it("máximo 2 abiertas por sector", () => {
    const open = [{ ticker: "LRCX", sector: "Technology" }, { ticker: "KLAC", sector: "Technology" }]
    expect(openBlockers({ ...base, openPositions: open })).toEqual(["SECTOR_LIMIT"])
    expect(openBlockers({ ...base, openPositions: open.slice(0, 1) })).toEqual([])
  })

  it("sector null cuenta como un sector más", () => {
    const candidate = { ticker: "FISV", passes: true, sector: null }
    const open = [{ ticker: "X", sector: null }, { ticker: "Y", sector: null }]
    expect(openBlockers({ ...base, candidate, openPositions: open })).toEqual(["SECTOR_LIMIT"])
    expect(openBlockers({ ...base, candidate, openPositions: [{ ticker: "Z", sector: "Technology" }] })).toEqual([])
  })
})
