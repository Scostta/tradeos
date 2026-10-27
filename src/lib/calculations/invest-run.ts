import { monthKey, shiftMonth } from "./invest-fx"

/**
 * §1.4: solo se decide con el run del mes en curso, que evalúa el cierre del
 * mes anterior (run_date = último día hábil de ese mes). `today` en UTC.
 */
export function isCurrentMonthRun(runDate: string, today: string): boolean {
  return monthKey(runDate) === shiftMonth(monthKey(today), -1)
}

/** price / sma10m − 1; null si falta alguno. Solo para mostrar. */
export function distanceToSma(price: number | null, sma10m: number | null): number | null {
  if (price == null || sma10m == null || sma10m === 0) return null
  return price / sma10m - 1
}
