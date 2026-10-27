import { describe, it, expect } from "vitest"
import { distanceToSma, isCurrentMonthRun } from "./invest-run"

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
