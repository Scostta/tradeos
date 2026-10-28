import { describe, it, expect } from "vitest"
import { cadenceOf, detectRecurring, nextCharge } from "./recurring"
import type { RecurringInput } from "./recurring"

const charge = (counterparty: string, bookedAt: string, amount: number, extra: Partial<RecurringInput> = {}): RecurringInput => ({
  counterparty, bookedAt, amount, categoryId: null, excluded: false, ...extra,
})

describe("cadenceOf", () => {
  it("semanal 6–8, mensual 28–33, trimestral 85–97, anual 355–375", () => {
    expect([7, 30, 91, 365].map(cadenceOf)).toEqual(["weekly", "monthly", "quarterly", "yearly"])
    expect([5, 20, 40, 120, 380].map(cadenceOf)).toEqual([null, null, null, null, null])
  })
})

describe("nextCharge", () => {
  it("suma la cadencia conservando el día (y el último día si no existe)", () => {
    expect(nextCharge("2026-10-03", "monthly")).toBe("2026-11-03")
    expect(nextCharge("2026-01-31", "monthly")).toBe("2026-02-28")
    expect(nextCharge("2026-10-03", "quarterly")).toBe("2027-01-03")
    expect(nextCharge("2026-10-03", "weekly")).toBe("2026-10-10")
  })
})

describe("detectRecurring", () => {
  it("Netflix mensual", () => {
    const txs = ["05", "06", "07", "08", "09", "10"].map(m => charge("netflix.com", `2026-${m}-03`, -12.99, { categoryId: "subs" }))
    expect(detectRecurring(txs)).toEqual([{
      counterparty: "netflix.com", amount: 12.99, cadence: "monthly", categoryId: "subs",
      firstSeen: "2026-05-03", lastSeen: "2026-10-03", nextExpected: "2026-11-03", occurrences: 6,
      intervalMedian: 31, intervalSpread: 1, amountSpread: 0,   // 31, 30, 31, 31, 30 días
    }])
  })

  it("seguro trimestral", () => {
    const txs = ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"].map(d => charge("mapfre seguros", d, -120))
    const [c] = detectRecurring(txs)
    expect(c).toMatchObject({ cadence: "quarterly", occurrences: 4, amount: 120, nextExpected: "2027-01-15" })
  })

  it("Bizum irregular no es recurrente", () => {
    const txs = [
      charge("cena", "2026-07-02", -12), charge("cena", "2026-07-19", -35),
      charge("cena", "2026-08-30", -8), charge("cena", "2026-09-04", -20), charge("cena", "2026-10-21", -21),
    ]
    expect(detectRecurring(txs)).toEqual([])
  })

  it("una subida de 9,99 a 12,99 sigue siendo una sola suscripción, con el importe nuevo", () => {
    const old = ["03", "04", "05", "06"].map(m => charge("spotify", `2026-${m}-10`, -9.99))
    const raised = ["07", "08", "09"].map(m => charge("spotify", `2026-${m}-10`, -12.99))
    const result = detectRecurring([...old, ...raised])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ amount: 12.99, cadence: "monthly", firstSeen: "2026-07-10", occurrences: 3 })
  })

  it("un parking con ±8 % es candidato (el usuario decide) y lo dice amountSpread", () => {
    const txs = [50, 53, 47, 51].map((a, i) => charge("parking centro", `2026-0${6 + i}-01`, -a))
    const [c] = detectRecurring(txs)
    expect(c).toMatchObject({ cadence: "monthly", occurrences: 4, amount: 51 })
    expect(c!.amountSpread).toBeGreaterThan(0.05)
    expect(c!.amountSpread).toBeLessThan(0.1)
  })

  it("ignora ingresos, excluidos, contrapartes vacías y un solo cargo", () => {
    const txs = [
      charge("nomina", "2026-09-28", 2100), charge("nomina", "2026-10-28", 2100),
      charge("gym", "2026-09-01", -30, { excluded: true }), charge("gym", "2026-10-01", -30, { excluded: true }),
      charge("", "2026-09-01", -5), charge("", "2026-10-01", -5),
      charge("once", "2026-10-01", -9),
    ]
    expect(detectRecurring(txs)).toEqual([])
  })

  it("un hueco rompe la racha: cuenta solo la parte final regular", () => {
    const txs = ["2026-01-05", "2026-02-05", "2026-06-05", "2026-07-05", "2026-08-05"].map(d => charge("gym", d, -30))
    expect(detectRecurring(txs)[0]).toMatchObject({ firstSeen: "2026-06-05", occurrences: 3 })
  })
})
