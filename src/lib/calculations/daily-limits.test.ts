import { describe, it, expect } from "vitest"
import { dayBreaches, limitBreaches, limitsByAccount } from "./daily-limits"

// Trades de un día: entrada a las HH:00, salida a las HH:30.
const t = (id: string, hour: number, netPnl: number, opts: { breakEven?: boolean; accountId?: string; exitHour?: number } = {}) => ({
  id,
  accountId: opts.accountId ?? "a",
  entryTime: `2026-10-29T${String(hour).padStart(2, "0")}:00:00Z`,
  exitTime:  `2026-10-29T${String(opts.exitHour ?? hour).padStart(2, "0")}:30:00Z`,
  netPnl,
  breakEven: opts.breakEven ?? false,
})

const none = { maxTrades: null, maxLoss: null, maxStreak: null }

describe("dayBreaches", () => {
  it("sin límites no marca nada", () => {
    expect(dayBreaches([t("1", 9, -500)], none).size).toBe(0)
  })

  it("max trades: marca los que pasan del límite", () => {
    const b = dayBreaches([t("1", 9, 10), t("2", 10, 10), t("3", 11, 10)], { ...none, maxTrades: 2 })
    expect([...b.entries()]).toEqual([["3", ["trades"]]])
  })

  it("pérdida máxima: cuenta lo cerrado antes de la entrada", () => {
    const trades = [t("1", 9, -200), t("2", 10, -100), t("3", 11, 50)]
    const b = dayBreaches(trades, { ...none, maxLoss: 300 })
    expect([...b.keys()]).toEqual(["3"])   // tras −300; el 2 entró con −200
  })

  it("un trade abierto antes de que cierre el anterior no cuenta su resultado", () => {
    const trades = [t("1", 9, -400, { exitHour: 11 }), t("2", 10, -10)]
    expect(dayBreaches(trades, { ...none, maxLoss: 300 }).size).toBe(0)
  })

  it("racha de pérdidas: los BE ni suman ni cortan", () => {
    const trades = [t("1", 9, -50), t("2", 10, 1, { breakEven: true }), t("3", 11, -60), t("4", 12, 30)]
    const b = dayBreaches(trades, { ...none, maxStreak: 2 })
    expect([...b.entries()]).toEqual([["4", ["streak"]]])
  })

  it("una ganancia corta la racha", () => {
    const trades = [t("1", 9, -50), t("2", 10, 80), t("3", 11, -60), t("4", 12, 30)]
    expect(dayBreaches(trades, { ...none, maxStreak: 2 }).size).toBe(0)
  })

  it("un trade puede incumplir varios límites", () => {
    const trades = [t("1", 9, -200), t("2", 10, -200), t("3", 11, 10)]
    expect(dayBreaches(trades, { maxTrades: 2, maxLoss: 300, maxStreak: 2 }).get("3")).toEqual(["trades", "loss", "streak"])
  })
})

describe("limitBreaches", () => {
  it("cada cuenta con sus límites y cada día por separado", () => {
    const trades = [
      t("a1", 9, 10), t("a2", 10, 10),
      t("b1", 9, 10, { accountId: "b" }), t("b2", 10, 10, { accountId: "b" }),
      { ...t("a3", 9, 10), entryTime: "2026-10-30T09:00:00Z", exitTime: "2026-10-30T09:30:00Z" },
    ]
    const limits = limitsByAccount([
      { id: "a", maxTradesPerDay: 1, maxDailyLoss: null, maxConsecutiveLosses: null },
      { id: "b", maxTradesPerDay: null, maxDailyLoss: null, maxConsecutiveLosses: null },
    ])
    expect([...limitBreaches(trades, limits).keys()]).toEqual(["a2"])
  })
})
