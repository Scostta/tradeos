// Fechas YYYY-MM-DD de Money, siempre en UTC (sin horas ni zona).

const DAY_MS = 86_400_000

const toUtc = (date: string): number => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

/** Suma meses conservando el día; si no existe en el mes de destino, el último (31/01 + 1 → 28/02). */
export function addMonths(date: string, months: number): string {
  const y = +date.slice(0, 4), m = +date.slice(5, 7) - 1, d = +date.slice(8, 10)
  const target = new Date(Date.UTC(y, m + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return fromUtc(target.getTime())
}

export type MonthKey = string   // YYYY-MM

export function shiftMonth(month: MonthKey, months: number): MonthKey {
  return addMonths(`${month}-01`, months).slice(0, 7)
}

/**
 * Periodo [from, to) del "mes" `month` con el día de inicio del usuario
 * (finance_settings.month_start_day): con día 25, el mes 2026-10 va del
 * 25/10 al 24/11. Con día 1 es el mes natural.
 */
export function monthPeriod(month: MonthKey, startDay = 1): { from: string; to: string } {
  const day = String(startDay).padStart(2, "0")
  return { from: `${month}-${day}`, to: `${shiftMonth(month, 1)}-${day}` }
}

/** Mes (periodo) al que pertenece `date` con ese día de inicio. */
export function monthOf(date: string, startDay = 1): MonthKey {
  const month = date.slice(0, 7)
  return +date.slice(8, 10) >= startDay ? month : shiftMonth(month, -1)
}
