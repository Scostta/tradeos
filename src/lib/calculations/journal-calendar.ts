import { zonedDateKey } from "~/helpers/tz"
import type { JournalEntry, JournalDay } from "~/types/journal"
import type { Trade } from "~/types/trade"

/** "YYYY-MM-DD" for a grid cell built from plain Y/M/D numbers. */
function gridDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function buildCalendar(
  year: number,
  month: number,
  entries: JournalEntry[],
  trades: Trade[],
  timeZone = "UTC",
): { weeks: (JournalDay | null)[][]; monthNet: number } {
  const entryByDate = new Map<string, JournalEntry>()
  for (const e of entries) entryByDate.set(e.date, e)

  const tradesByDate = new Map<string, Trade[]>()
  for (const t of trades) {
    const key = zonedDateKey(t.entryTime, timeZone)
    const existing = tradesByDate.get(key) ?? []
    existing.push(t)
    tradesByDate.set(key, existing)
  }

  const firstDay    = new Date(Date.UTC(year, month - 1, 1))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const startDow    = firstDay.getUTCDay()

  const allDays: (JournalDay | null)[] = []

  for (let i = 0; i < startDow; i++) allDays.push(null)

  let monthNet = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const key        = gridDateKey(year, month, d)
    const dayTrades  = tradesByDate.get(key) ?? []
    const net        = dayTrades.reduce((s, t) => s + t.netPnl, 0)
    const wins       = dayTrades.filter((t) => t.netPnl > 0).length
    const dow        = new Date(Date.UTC(year, month - 1, d)).getUTCDay()

    monthNet += net

    allDays.push({
      date:       key,
      day:        d,
      isWeekend:  dow === 0 || dow === 6,
      entry:      entryByDate.get(key) ?? null,
      trades:     dayTrades.map((t) => ({
        id:         t.id,
        accountId:  t.accountId,
        instrument: t.instrument,
        direction:  t.direction,
        contracts:  t.contracts,
        netPnl:     t.netPnl,
        entryTime:  t.entryTime,
      })),
      net,
      tradeCount: dayTrades.length,
      winRate:    dayTrades.length > 0 ? wins / dayTrades.length : 0,
    })
  }

  while (allDays.length % 7 !== 0) allDays.push(null)

  const weeks: (JournalDay | null)[][] = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7))
  }

  return { weeks, monthNet }
}
