import { zonedDateKey } from "~/helpers/tz"
import { isLoss } from "./outcome"
import type { Trade } from "~/types/trade"

// Límites diarios personales por cuenta (accounts.max_trades_per_day,
// max_daily_loss, max_consecutive_losses). Un trade incumple un límite si se
// abrió cuando ya se había llegado a él ese día en esa cuenta:
//   trades → ya había `maxTrades` trades abiertos antes ese día
//   loss   → el P&L neto de los trades cerrados antes de su entrada ≤ −maxLoss
//   streak → los últimos `maxStreak` trades cerrados antes de su entrada son
//            pérdidas seguidas (los BE ni suman ni cortan la racha)

export type DailyLimits = {
  maxTrades: number | null
  maxLoss:   number | null
  maxStreak: number | null
}

export type LimitBreach = "trades" | "loss" | "streak"

type LimitTrade = Pick<Trade, "id" | "accountId" | "entryTime" | "exitTime" | "netPnl" | "breakEven">

const time = (iso: string): number => new Date(iso).getTime()

export function hasLimits(l: DailyLimits): boolean {
  return l.maxTrades != null || l.maxLoss != null || l.maxStreak != null
}

/** Incumplimientos de los trades de un día y una cuenta. Solo devuelve los que tienen alguno. */
export function dayBreaches(trades: LimitTrade[], limits: DailyLimits): Map<string, LimitBreach[]> {
  const out = new Map<string, LimitBreach[]>()
  if (!hasLimits(limits)) return out
  const byEntry = [...trades].sort((a, b) => time(a.entryTime) - time(b.entryTime))
  const byExit = [...trades].sort((a, b) => time(a.exitTime) - time(b.exitTime))

  byEntry.forEach((t, i) => {
    const entry = time(t.entryTime)
    const closedBefore = byExit.filter(c => c.id !== t.id && time(c.exitTime) <= entry)
    const breaches: LimitBreach[] = []

    if (limits.maxTrades != null && i >= limits.maxTrades) breaches.push("trades")

    if (limits.maxLoss != null) {
      const net = closedBefore.reduce((s, c) => s + c.netPnl, 0)
      if (net <= -limits.maxLoss) breaches.push("loss")
    }

    if (limits.maxStreak != null) {
      let streak = 0
      for (let j = closedBefore.length - 1; j >= 0; j--) {
        const c = closedBefore[j]!
        if (c.breakEven) continue
        if (!isLoss(c)) break
        streak++
      }
      if (streak >= limits.maxStreak) breaches.push("streak")
    }

    if (breaches.length > 0) out.set(t.id, breaches)
  })
  return out
}

/**
 * Incumplimientos de un conjunto de trades: agrupa por cuenta y día (zona del
 * usuario) y aplica los límites de cada cuenta.
 */
export function limitBreaches(
  trades: LimitTrade[],
  limitsByAccount: Map<string, DailyLimits>,
  timeZone = "UTC",
): Map<string, LimitBreach[]> {
  const groups = new Map<string, LimitTrade[]>()
  for (const t of trades) {
    if (!limitsByAccount.has(t.accountId)) continue
    const key = `${t.accountId}|${zonedDateKey(t.entryTime, timeZone)}`
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const out = new Map<string, LimitBreach[]>()
  for (const [key, ts] of groups) {
    const limits = limitsByAccount.get(key.split("|")[0]!)!
    for (const [id, b] of dayBreaches(ts, limits)) out.set(id, b)
  }
  return out
}

/** Límites de cada cuenta que tiene alguno. */
export function limitsByAccount(
  accounts: { id: string; maxTradesPerDay: number | null; maxDailyLoss: number | null; maxConsecutiveLosses: number | null }[],
): Map<string, DailyLimits> {
  const out = new Map<string, DailyLimits>()
  for (const a of accounts) {
    const l = { maxTrades: a.maxTradesPerDay, maxLoss: a.maxDailyLoss, maxStreak: a.maxConsecutiveLosses }
    if (hasLimits(l)) out.set(a.id, l)
  }
  return out
}
