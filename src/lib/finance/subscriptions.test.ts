import { describe, it, expect } from "vitest"
import { candidatesToCancel, chargingAgain, daysToNext, monthlyCost, monthsSince, yearlyCost } from "./subscriptions"
import type { SubscriptionLike } from "./subscriptions"

const sub = (extra: Partial<SubscriptionLike> = {}): SubscriptionLike => ({
  amount: 12, cadence: "monthly", status: "confirmed", usage: "used", unusedSince: null,
  lastSeen: "2026-10-12", nextExpected: "2026-11-12", updatedAt: "2026-10-20T10:00:00Z", ...extra,
})

describe("coste normalizado", () => {
  it("mensual: anuales / 12, trimestrales / 3, semanales × 52/12", () => {
    expect(monthlyCost(sub({ amount: 120, cadence: "yearly" }))).toBe(10)
    expect(monthlyCost(sub({ amount: 90, cadence: "quarterly" }))).toBe(30)
    expect(monthlyCost(sub({ amount: 3, cadence: "weekly" }))).toBe(13)
    expect(monthlyCost(sub({ amount: 8.99 }))).toBe(8.99)
  })

  it("anual = mensual × 12", () => {
    expect(yearlyCost(sub({ amount: 8.99 }))).toBe(107.88)
    expect(yearlyCost(sub({ amount: 59.95, cadence: "yearly" }))).toBe(59.95)
  })
})

describe("candidatesToCancel", () => {
  it("confirmadas sin usar desde hace 2 meses o más", () => {
    const subs = [
      sub({ usage: "unused", unusedSince: "2026-08-01" }),                          // 2,9 meses → sí
      sub({ usage: "unused", unusedSince: "2026-09-20" }),                          // 1 mes → aún no
      sub({ usage: "unused", unusedSince: "2026-07-01", status: "pending" }),       // sin confirmar → no
      sub({ usage: "fixed" }),
    ]
    expect(candidatesToCancel(subs, "2026-10-28")).toEqual([subs[0]])
    expect(monthsSince("2026-08-28", "2026-10-28")).toBe(2)
  })
})

describe("chargingAgain", () => {
  it("canceladas con un cargo posterior a la cancelación", () => {
    const back = sub({ status: "cancelled", updatedAt: "2026-09-15T08:00:00Z", lastSeen: "2026-10-12" })
    const gone = sub({ status: "cancelled", updatedAt: "2026-10-20T08:00:00Z", lastSeen: "2026-10-12" })
    expect(chargingAgain([back, gone, sub()])).toEqual([back])
  })
})

describe("daysToNext", () => {
  it("días hasta el próximo cargo, negativo si ya debería haber pasado", () => {
    expect(daysToNext(sub(), "2026-11-09")).toBe(3)
    expect(daysToNext(sub(), "2026-11-15")).toBe(-3)
    expect(daysToNext(sub({ nextExpected: null }), "2026-11-15")).toBeNull()
  })
})
