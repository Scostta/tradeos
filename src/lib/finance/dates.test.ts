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
    // Día > 15: el periodo se llama como el mes en que termina (la mayoría de sus días).
    expect(monthPeriod("2026-11", 25)).toEqual({ from: "2026-10-25", to: "2026-11-25" })
    expect(monthPeriod("2027-01", 25)).toEqual({ from: "2026-12-25", to: "2027-01-25" })
    expect(monthOf("2026-10-24", 25)).toBe("2026-10")
    expect(monthOf("2026-10-25", 25)).toBe("2026-11")
    expect(monthOf("2026-12-31", 25)).toBe("2027-01")
    // Día ≤ 15: se llama como el mes en que empieza.
    expect(monthPeriod("2026-10", 10)).toEqual({ from: "2026-10-10", to: "2026-11-10" })
    expect(monthOf("2026-10-09", 10)).toBe("2026-09")
    expect(monthOf("2026-10-10", 10)).toBe("2026-10")
    expect(monthOf("2026-10-01")).toBe("2026-10")
  })
})
