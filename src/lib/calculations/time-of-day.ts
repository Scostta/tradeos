// ── Time-of-day & session analysis ────────────────────────────────────────────
// Pure functions for the Reports "Time" tab. Hour-of-day and weekday are derived
// from entryTime in the user's timezone (always available); session uses the
// stored `session` field (RTH/ETH/overnight), bucketing nulls as "Unspecified".

import { zonedParts } from "~/helpers/tz"
import type { Trade } from "~/types/trade"
import type { HourWeekdayMatrix } from "~/types/reports"

const pad2 = (n: number): string => String(n).padStart(2, "0")

/** Groups by hour of day (00:00–23:00) in the given timezone. */
export function byHourOfDay(timeZone = "UTC"): (trade: Trade) => string {
  return (trade: Trade): string => `${pad2(zonedParts(trade.entryTime, timeZone).hour)}:00`
}

/** Sorts hour-label rows ("HH:00") chronologically by hour. */
export function sortByHour<T extends { label: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => parseInt(a.label, 10) - parseInt(b.label, 10))
}

const SESSION_LABELS: Record<string, string> = {
  RTH:       "RTH",
  ETH:       "ETH",
  overnight: "Overnight",
}

/** Groups by trading session; trades with no session fall into "Unspecified". */
export function bySession(trade: Trade): string {
  return trade.session != null ? (SESSION_LABELS[trade.session] ?? trade.session) : "Unspecified"
}

/**
 * Net P&L per hour for the bar chart. Returns one point per hour that has at
 * least one trade, ordered chronologically. label is the 2-digit hour ("09").
 */
export function buildHourBars(trades: Trade[], timeZone = "UTC"): { label: string; v: number }[] {
  const byHour = new Map<number, number>()
  for (const t of trades) {
    const h = zonedParts(t.entryTime, timeZone).hour
    byHour.set(h, (byHour.get(h) ?? 0) + t.netPnl)
  }
  return Array.from(byHour.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, v]) => ({ label: pad2(hour), v }))
}

// Monday-first ordering; futures also trade Sunday evening (Globex), so weekends
// are included when present.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY_LABELS: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
}

/**
 * Net P&L matrix of weekday rows × hour columns. Only hours and weekdays that
 * have at least one trade are included. The star view for intraday futures:
 * surfaces exactly which hour on which day prints or bleeds.
 */
export function computeHourWeekdayMatrix(trades: Trade[], timeZone = "UTC"): HourWeekdayMatrix {
  const hourSet    = new Set<number>()
  const weekdaySet = new Set<number>()
  const cellMap    = new Map<string, { v: number; trades: number }>()

  for (const t of trades) {
    const { hour, weekday } = zonedParts(t.entryTime, timeZone)
    hourSet.add(hour)
    weekdaySet.add(weekday)
    const key = `${weekday}:${hour}`
    const cur = cellMap.get(key) ?? { v: 0, trades: 0 }
    cur.v      += t.netPnl
    cur.trades += 1
    cellMap.set(key, cur)
  }

  const hours = Array.from(hourSet).sort((a, b) => a - b)
  const rows = WEEKDAY_ORDER.filter(w => weekdaySet.has(w)).map(weekday => ({
    weekday,
    label: WEEKDAY_LABELS[weekday]!,
    cells: hours.map(hour => {
      const c = cellMap.get(`${weekday}:${hour}`) ?? { v: 0, trades: 0 }
      return { hour, v: c.v, trades: c.trades }
    }),
  }))

  return { hours, rows }
}
