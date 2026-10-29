import { describe, it, expect } from "vitest"
import { buildWeekRecap, weekStart } from "./week-recap"
import type { JournalEntry } from "~/types/journal"
import type { Trade } from "~/types/trade"

// NQ ($20/pt), stop a 10 pts: riesgo $200.
function tr(id: string, day: string, hour: number, netPnl: number, over: Partial<Trade> = {}): Trade {
  const entry = `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`
  return {
    id, userId: "u", accountId: "a", tradeNumber: null, instrument: "NQ", direction: "long", contracts: 1,
    entryPrice: 20000, exitPrice: 20000, entryTime: entry, exitTime: entry.replace(":00:00", ":30:00"),
    pnl: netPnl, commission: 0, commissionEstimated: false, breakEven: false, beOverride: null, reviewedAt: null,
    netPnl, mae: null, mfe: null, stopPrice: 19990, playbookId: null, session: null, notes: null, tags: null,
    followedRules: null, mistakes: null, createdAt: entry,
    ...over,
  }
}

const entry = (date: string, over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: "00000000-0000-0000-0000-000000000000", userId: "u", date,
  preMarketNotes: null, postMarketNotes: null, mood: null, followedPlan: null, createdAt: `${date}T22:00:00.000Z`,
  ...over,
})

// Semana del domingo 25/10/2026 al sábado 31/10/2026.
const trades: Trade[] = [
  tr("p1", "2026-10-21", 14, 100),                                                 // semana anterior
  tr("1", "2026-10-26", 14, 300, { playbookId: "pb1", reviewedAt: "2026-10-26T20:00:00Z" }),
  tr("2", "2026-10-26", 15, -150, { mistakes: ["FOMO"] }),
  tr("3", "2026-10-26", 16, -100, { mistakes: ["FOMO", "Oversized"] }),
  tr("4", "2026-10-27", 14, 2, { breakEven: true, mfe: 250 }),                     // BE que tocó 1.25R
  tr("5", "2026-10-28", 14, -80, { playbookId: "pb1" }),
  tr("n1", "2026-11-02", 14, 999),                                                 // semana siguiente
]

const recap = buildWeekRecap({
  from: "2026-10-25",
  trades,
  entries: [entry("2026-10-26", { mood: 2, followedPlan: false, postMarketNotes: "Chased after the loss" }), entry("2026-10-29", { mood: 4 })],
  playbookNames: new Map([["pb1", "ES.1 Reversión"]]),
  limits: new Map([["a", { maxTrades: 2, maxLoss: null, maxStreak: null }]]),
  riskByAccount: new Map(),
  timeZone: "UTC",
})

describe("weekStart", () => {
  it("domingo de la fila del calendario", () => {
    expect(weekStart("2026-10-29")).toBe("2026-10-25")
    expect(weekStart("2026-10-25")).toBe("2026-10-25")
  })
})

describe("buildWeekRecap", () => {
  it("solo los trades de la semana, con W/L/BE y la semana anterior", () => {
    expect(recap).toMatchObject({
      from: "2026-10-25", to: "2026-10-31",
      netPnl: -28, prevNetPnl: 100, trades: 5, wins: 1, losses: 3, breakEven: 1,
    })
    expect(recap.winRate).toBe(0.25)
  })

  it("mejor y peor día", () => {
    expect(recap.bestDay).toEqual({ date: "2026-10-26", net: 50 })
    expect(recap.worstDay).toEqual({ date: "2026-10-28", net: -80 })
  })

  it("días con trades o con entrada del diario", () => {
    expect(recap.days.map(d => d.date)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"])
    expect(recap.days[0]).toMatchObject({ net: 50, trades: 3, mood: 2, followedPlan: false, notes: "Chased after the loss" })
    expect(recap.days[3]).toMatchObject({ trades: 0, mood: 4 })
  })

  it("errores más caros y playbooks", () => {
    expect(recap.mistakes[0]).toEqual({ label: "FOMO", trades: 2, netPnl: -250 })
    expect(recap.playbooks).toEqual([
      { name: "ES.1 Reversión", trades: 2, netPnl: 220 },
      { name: null, trades: 3, netPnl: -248 },
    ])
  })

  it("límites, BE a +1R y revisión", () => {
    expect(recap.breaches).toEqual({ trades: 1, loss: 0, streak: 0 })   // el tercer trade del lunes
    expect(recap.beReached1R).toBe(1)
    expect(recap.reviewed).toEqual({ done: 1, total: 5 })
  })
})
