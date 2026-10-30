import { zonedDateKey } from "~/helpers/tz"
import { isLoss } from "./outcome"
import type { Trade } from "~/types/trade"

// Límites diarios personales por cuenta (accounts.max_trades_per_day,
// max_daily_loss, max_consecutive_losses, revenge_minutes). Un trade incumple
// un límite si se abrió cuando ya se había llegado a él ese día en esa cuenta:
//   trades  → ya había `maxTrades` trades abiertos antes ese día
//   loss    → el P&L neto de los trades cerrados antes de su entrada ≤ −maxLoss
//   streak  → los últimos `maxStreak` trades cerrados antes de su entrada son
//             pérdidas seguidas (los BE ni suman ni cortan la racha)
//   revenge → el último trade cerrado antes de su entrada fue una pérdida y
//             entró menos de `revengeMinutes` después de esa salida
//   sizeUp  → el último trade cerrado antes de su entrada fue una pérdida y
//             entró con más contratos (con revengeMinutes activo, sin plazo)

export type DailyLimits = {
  maxTrades:      number | null
  maxLoss:        number | null
  maxStreak:      number | null
  revengeMinutes: number | null
}

export type LimitBreach = "trades" | "loss" | "streak" | "revenge" | "sizeUp"

export const LIMIT_BREACHES: LimitBreach[] = ["trades", "loss", "streak", "revenge", "sizeUp"]

export type LimitTrade = Pick<Trade, "id" | "accountId" | "entryTime" | "exitTime" | "netPnl" | "breakEven" | "contracts">

/** Lo que había pasado ese día en esa cuenta cuando se abrió un trade. */
export type TradeContext = {
  index:     number                // 0 = primer trade del día
  closed:    LimitTrade[]          // cerrados antes de su entrada, por hora de salida
  previous:  LimitTrade | null     // el último de ellos
  gapMin:    number | null         // minutos desde la salida de `previous`
  netBefore: number                // neto de los cerrados antes
  streak:    number                // pérdidas seguidas antes (los BE no cortan)
}

const time = (iso: string): number => new Date(iso).getTime()

export function hasLimits(l: DailyLimits): boolean {
  return l.maxTrades != null || l.maxLoss != null || l.maxStreak != null || l.revengeMinutes != null
}

/** Contexto de cada trade de un día y una cuenta, por orden de entrada. */
export function dayContext<T extends LimitTrade>(trades: T[]): { trade: T; ctx: TradeContext }[] {
  const byEntry = [...trades].sort((a, b) => time(a.entryTime) - time(b.entryTime))
  const byExit  = [...trades].sort((a, b) => time(a.exitTime) - time(b.exitTime))

  return byEntry.map((t, index) => {
    const entry    = time(t.entryTime)
    const closed   = byExit.filter(c => c.id !== t.id && time(c.exitTime) <= entry)
    const previous = closed[closed.length - 1] ?? null
    let streak = 0
    for (let j = closed.length - 1; j >= 0; j--) {
      const c = closed[j]!
      if (c.breakEven) continue
      if (!isLoss(c)) break
      streak++
    }
    return {
      trade: t,
      ctx: {
        index, closed, previous, streak,
        gapMin:    previous ? (entry - time(previous.exitTime)) / 60_000 : null,
        netBefore: closed.reduce((s, c) => s + c.netPnl, 0),
      },
    }
  })
}

/** ¿Entró rápido tras una pérdida? (marca `revenge`) */
export function isFastAfterLoss(ctx: TradeContext, minutes: number): boolean {
  return ctx.previous != null && isLoss(ctx.previous) && ctx.gapMin != null && ctx.gapMin < minutes
}

/** ¿Entró con más contratos que la pérdida anterior? (marca `sizeUp`) */
export function isSizeUpAfterLoss(t: LimitTrade, ctx: TradeContext): boolean {
  return ctx.previous != null && isLoss(ctx.previous) && t.contracts > ctx.previous.contracts
}

/** Incumplimientos de los trades de un día y una cuenta. Solo devuelve los que tienen alguno. */
export function dayBreaches(trades: LimitTrade[], limits: DailyLimits): Map<string, LimitBreach[]> {
  const out = new Map<string, LimitBreach[]>()
  if (!hasLimits(limits)) return out

  for (const { trade: t, ctx } of dayContext(trades)) {
    const breaches: LimitBreach[] = []
    if (limits.maxTrades != null && ctx.index >= limits.maxTrades) breaches.push("trades")
    if (limits.maxLoss != null && ctx.netBefore <= -limits.maxLoss) breaches.push("loss")
    if (limits.maxStreak != null && ctx.streak >= limits.maxStreak) breaches.push("streak")
    if (limits.revengeMinutes != null) {
      if (isFastAfterLoss(ctx, limits.revengeMinutes)) breaches.push("revenge")
      if (isSizeUpAfterLoss(t, ctx)) breaches.push("sizeUp")
    }
    if (breaches.length > 0) out.set(t.id, breaches)
  }
  return out
}

/** Agrupa por cuenta y día (zona del usuario). */
export function byAccountDay<T extends Pick<Trade, "accountId" | "entryTime">>(trades: T[], timeZone = "UTC"): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const t of trades) {
    const key = `${t.accountId}|${zonedDateKey(t.entryTime, timeZone)}`
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  return groups
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
  const out = new Map<string, LimitBreach[]>()
  const withLimits = trades.filter(t => limitsByAccount.has(t.accountId))
  for (const [key, ts] of byAccountDay(withLimits, timeZone)) {
    const limits = limitsByAccount.get(key.split("|")[0]!)!
    for (const [id, b] of dayBreaches(ts, limits)) out.set(id, b)
  }
  return out
}

/** Límites de cada cuenta que tiene alguno. */
export function limitsByAccount(
  accounts: {
    id: string
    maxTradesPerDay: number | null
    maxDailyLoss: number | null
    maxConsecutiveLosses: number | null
    revengeMinutes: number | null
  }[],
): Map<string, DailyLimits> {
  const out = new Map<string, DailyLimits>()
  for (const a of accounts) {
    const l = {
      maxTrades: a.maxTradesPerDay, maxLoss: a.maxDailyLoss, maxStreak: a.maxConsecutiveLosses,
      revengeMinutes: a.revengeMinutes,
    }
    if (hasLimits(l)) out.set(a.id, l)
  }
  return out
}
