import { describe, it, expect } from "vitest"
import { addDays, addMonths, daysBetween, monthOf, monthPeriod, shiftMonth } from "./dates"

describe("dates", () => {
  it("daysBetween y addDays cruzan meses y años", () => {
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3)
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02")
  })

  it("addMonths conserva el día o usa el último del mes", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28")
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29")
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15")
    expect(shiftMonth("2026-01", -2)).toBe("2025-11")
  })

  it("monthPeriod y monthOf con el día de inicio del usuario", () => {
    expect(monthPeriod("2026-10")).toEqual({ from: "2026-10-01", to: "2026-11-01" })
    expect(monthPeriod("2026-12", 25)).toEqual({ from: "2026-12-25", to: "2027-01-25" })
    expect(monthOf("2026-10-24", 25)).toBe("2026-09")
    expect(monthOf("2026-10-25", 25)).toBe("2026-10")
    expect(monthOf("2026-10-01")).toBe("2026-10")
  })
})
