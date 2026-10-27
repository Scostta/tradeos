import { describe, it, expect } from "vitest"
import { distanceToSma, isCurrentMonthRun, openBlockers, positionsForLimits, startedAtAfterOpen } from "./invest-run"

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

describe("papel (§1.6)", () => {
  const pos = (ticker: string, paper: boolean, closedAt: string | null = null) => ({ ticker, paper, closedAt, sector: "Technology" })

  it("en modo papel, las de papel pasan por los mismos límites que las reales", () => {
    const open = positionsForLimits([pos("LRCX", true), pos("KLAC", true), pos("OLD", true, "2026-10-01")], true)
    expect(open.map(p => p.ticker)).toEqual(["LRCX", "KLAC"])
    const candidate = { ticker: "MU", passes: true, sector: "Technology" }
    expect(openBlockers({ isCurrentRun: true, candidate, openPositions: open, maxPositions: 5 })).toEqual(["SECTOR_LIMIT"])
    expect(openBlockers({ isCurrentRun: true, candidate: { ...candidate, ticker: "LRCX" }, openPositions: open, maxPositions: 5 }))
      .toEqual(["ALREADY_OPEN", "SECTOR_LIMIT"])
  })

  it("en modo real, las de papel abiertas no cuentan para máximo, sector ni ticker", () => {
    const all = [pos("MU", true), pos("LRCX", true), pos("KLAC", true), pos("A", true), pos("B", true), pos("ASML", false)]
    const open = positionsForLimits(all, false)
    expect(open.map(p => p.ticker)).toEqual(["ASML"])
    const candidate = { ticker: "MU", passes: true, sector: "Technology" }
    expect(openBlockers({ isCurrentRun: true, candidate, openPositions: open, maxPositions: 5 })).toEqual([])
  })

  it("started_at solo lo fija la primera posición real", () => {
    expect(startedAtAfterOpen(null, true, "2026-10-28")).toBeNull()               // papel: no
    expect(startedAtAfterOpen(null, false, "2026-11-03")).toBe("2026-11-03")      // primera real: sí
    expect(startedAtAfterOpen("2026-11-03", false, "2026-12-02")).toBe("2026-11-03") // siguientes: no cambia
  })
})
