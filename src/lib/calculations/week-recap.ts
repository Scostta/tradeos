import { zonedDateKey } from "~/helpers/tz"
import { isReviewed } from "~/helpers/trade-review"
import { computeBeStats } from "./be-analysis"
import { limitBreaches } from "./daily-limits"
import type { DailyLimits, LimitBreach } from "./daily-limits"
import { computeMistakeStats } from "./mistakes"
import { isLoss, isWin } from "./outcome"
import { profitFactor, totalNetPnl, winRate } from "./metrics"
import type { JournalEntry } from "~/types/journal"
import type { Trade } from "~/types/trade"

// Resumen de una semana del Journal (domingo → sábado, como las filas del
// calendario, en la zona del usuario): P&L, W/L/BE, días, errores, playbooks,
// límites diarios incumplidos, BE que tocaron +1R, revisión y el diario.

export type WeekRecapDay = {
  date:         string
  net:          number
  trades:       number
  mood:         number | null
  followedPlan: boolean | null
  notes:        string | null      // post-mercado
}

export type WeekRecap = {
  from:         string             // domingo
  to:           string             // sábado
  netPnl:       number
  prevNetPnl:   number | null      // semana anterior; null si no tuvo trades
  trades:       number
  wins:         number
  losses:       number
  breakEven:    number
  winRate:      number
  profitFactor: number
  bestDay:      { date: string; net: number } | null
  worstDay:     { date: string; net: number } | null
  days:         WeekRecapDay[]     // días con trades o con entrada en el diario
  mistakes:     { label: string; trades: number; netPnl: number }[]   // los 3 más caros primero
  playbooks:    { name: string | null; trades: number; netPnl: number }[]   // null = sin playbook
  breaches:     Record<LimitBreach, number> & { total: number }         // total = trades con algún límite incumplido
  beReached1R:  number             // BE que llegaron a +1R antes de volver
  reviewed:     { done: number; total: number }
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Domingo de la fila del calendario que contiene `date` (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.toISOString().slice(0, 10)
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function buildWeekRecap(args: {
  from:            string
  trades:          Trade[]           // pueden incluir otras semanas: se filtran aquí
  entries:         JournalEntry[]
  playbookNames:   Map<string, string>
  limits:          Map<string, DailyLimits>
  riskByAccount:   Map<string, number | null>
  timeZone:        string
}): WeekRecap {
  const { from, playbookNames, limits, riskByAccount, timeZone } = args
  const to = addDaysIso(from, 6)
  const prevFrom = addDaysIso(from, -7)
  const inRange = (t: Trade, a: string, b: string) => {
    const k = zonedDateKey(t.entryTime, timeZone)
    return k >= a && k <= b
  }
  const trades = args.trades.filter(t => inRange(t, from, to))
  const prev = args.trades.filter(t => inRange(t, prevFrom, addDaysIso(from, -1)))
  const entries = args.entries.filter(e => e.date >= from && e.date <= to)

  const byDay = new Map<string, Trade[]>()
  for (const t of trades) {
    const k = zonedDateKey(t.entryTime, timeZone)
    byDay.set(k, [...(byDay.get(k) ?? []), t])
  }
  const dayNets = [...byDay.entries()].map(([date, ts]) => ({ date, net: round2(totalNetPnl(ts)) }))
  const entryByDate = new Map(entries.map(e => [e.date, e]))
  const dates = [...new Set([...byDay.keys(), ...entryByDate.keys()])].sort()

  const byPlaybook = new Map<string | null, Trade[]>()
  for (const t of trades) byPlaybook.set(t.playbookId, [...(byPlaybook.get(t.playbookId) ?? []), t])

  const breaches = limitBreaches(trades, limits, timeZone)
  const breachCount = { trades: 0, loss: 0, streak: 0, revenge: 0, sizeUp: 0 }
  for (const list of breaches.values()) for (const b of list) breachCount[b]++

  return {
    from, to,
    netPnl:       round2(totalNetPnl(trades)),
    prevNetPnl:   prev.length ? round2(totalNetPnl(prev)) : null,
    trades:       trades.length,
    wins:         trades.filter(isWin).length,
    losses:       trades.filter(isLoss).length,
    breakEven:    trades.filter(t => t.breakEven).length,
    winRate:      winRate(trades),
    profitFactor: round2(profitFactor(trades)),
    bestDay:      dayNets.length ? dayNets.reduce((a, b) => (b.net > a.net ? b : a)) : null,
    worstDay:     dayNets.length ? dayNets.reduce((a, b) => (b.net < a.net ? b : a)) : null,
    days: dates.map(date => {
      const ts = byDay.get(date) ?? []
      const e = entryByDate.get(date)
      return {
        date,
        net:          round2(totalNetPnl(ts)),
        trades:       ts.length,
        mood:         e?.mood ?? null,
        followedPlan: e?.followedPlan ?? null,
        notes:        e?.postMarketNotes ?? null,
      }
    }),
    mistakes: computeMistakeStats(trades).slice(0, 3).map(m => ({ label: m.label, trades: m.trades, netPnl: round2(m.netPnl) })),
    playbooks: [...byPlaybook.entries()]
      .map(([id, ts]) => ({ name: id ? playbookNames.get(id) ?? null : null, trades: ts.length, netPnl: round2(totalNetPnl(ts)) }))
      .sort((a, b) => b.netPnl - a.netPnl),
    breaches:     { ...breachCount, total: breaches.size },
    beReached1R:  computeBeStats(trades, riskByAccount).reached.find(r => r.level === 1)?.count ?? 0,
    reviewed:     { done: trades.filter(isReviewed).length, total: trades.length },
  }
}
