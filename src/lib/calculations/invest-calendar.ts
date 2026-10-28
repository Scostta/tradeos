// Días hábiles NYSE para la app (INVEST_SPEC.md §3.1). Copia de NYSE_HOLIDAYS
// de scripts/screener/screener/market_calendar.py, que es la fuente: el test
// de este archivo falla si las dos listas no coinciden. Un año fuera de la
// lista lanza error en vez de suponer que todos sus días son hábiles.

const NYSE_HOLIDAYS = new Set(`
  2023-01-02 2023-01-16 2023-02-20 2023-04-07 2023-05-29 2023-06-19
  2023-07-04 2023-09-04 2023-11-23 2023-12-25
  2024-01-01 2024-01-15 2024-02-19 2024-03-29 2024-05-27 2024-06-19
  2024-07-04 2024-09-02 2024-11-28 2024-12-25
  2025-01-01 2025-01-09 2025-01-20 2025-02-17 2025-04-18 2025-05-26
  2025-06-19 2025-07-04 2025-09-01 2025-11-27 2025-12-25
  2026-01-01 2026-01-19 2026-02-16 2026-04-03 2026-05-25 2026-06-19
  2026-07-03 2026-09-07 2026-11-26 2026-12-25
  2027-01-01 2027-01-18 2027-02-15 2027-03-26 2027-05-31 2027-06-18
  2027-07-05 2027-09-06 2027-11-25 2027-12-24
  2028-01-17 2028-02-21 2028-04-14 2028-05-29 2028-06-19 2028-07-04
  2028-09-04 2028-11-23 2028-12-25
  2029-01-01 2029-01-15 2029-02-19 2029-03-30 2029-05-28 2029-06-19
  2029-07-04 2029-09-03 2029-11-22 2029-12-25
  2030-01-01 2030-01-21 2030-02-18 2030-04-19 2030-05-27 2030-06-19
  2030-07-04 2030-09-02 2030-11-28 2030-12-25
`.trim().split(/\s+/))

export const NYSE_HOLIDAY_LIST: readonly string[] = [...NYSE_HOLIDAYS].sort()

const FIRST_YEAR = 2023
const LAST_YEAR = 2030

const iso = (d: Date): string => d.toISOString().slice(0, 10)

export function isNyseBusinessDay(date: string): boolean {
  const year = Number(date.slice(0, 4))
  if (year < FIRST_YEAR || year > LAST_YEAR) {
    throw new Error(`${year} no está en NYSE_HOLIDAYS; amplía la lista`)
  }
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return weekday !== 0 && weekday !== 6 && !NYSE_HOLIDAYS.has(date)
}

/** Último día hábil NYSE del mes de `date` (YYYY-MM-DD). */
export function lastNyseBusinessDay(date: string): string {
  const [y, m] = date.split("-").map(Number)
  const d = new Date(Date.UTC(y!, m!, 0))   // día 0 del mes siguiente = último del mes
  while (!isNyseBusinessDay(iso(d))) d.setUTCDate(d.getUTCDate() - 1)
  return iso(d)
}

/**
 * Próximo cierre mensual en el que se evalúa la salida (§1.4): el último día
 * hábil del mes de `today`, o el del mes siguiente si ese ya pasó.
 */
export function nextMonthlyClose(today: string): string {
  const thisMonth = lastNyseBusinessDay(today)
  if (thisMonth >= today) return thisMonth
  const [y, m] = today.split("-").map(Number)
  return lastNyseBusinessDay(iso(new Date(Date.UTC(y!, m!, 1))))
}
