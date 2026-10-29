import { addDays, daysBetween, monthOf, monthPeriod, shiftMonth } from "./dates"
import type { MonthKey } from "./dates"
import { monthlySummary } from "./summary"
import type { SummaryCategory, SummaryTransaction } from "./summary"

// Cálculos del Overview (MONEY_SPEC.md §5.1) que no están en el resumen del mes.

/**
 * Ritmo frente al mes anterior: lo gastado este mes hasta `today` menos lo que
 * se había gastado el mes anterior en el mismo número de días. Negativo = vas
 * por debajo. null si el mes anterior no tiene datos.
 */
export function paceVsPreviousMonth(
  transactions: SummaryTransaction[],
  categories: SummaryCategory[],
  month: MonthKey,
  today: string,
  startDay = 1,
): number | null {
  const current = monthPeriod(month, startDay)
  if (today < current.from || today >= current.to) return null
  const elapsed = daysBetween(current.from, today) + 1
  const previous = monthPeriod(shiftMonth(month, -1), startDay)
  if (!transactions.some(t => t.bookedAt >= previous.from && t.bookedAt < previous.to)) return null

  const spentUntil = (from: string, days: number) => {
    const to = addDays(from, days)
    const window = transactions.filter(t => t.bookedAt >= from && t.bookedAt < to)
    // monthlySummary del mes de `from` restringido a la ventana: mismo criterio de gasto.
    return monthlySummary(window, categories, monthOf(from, startDay), { startDay }).spent
  }
  const prevDays = Math.min(elapsed, daysBetween(previous.from, previous.to))
  return Math.round((spentUntil(current.from, elapsed) - spentUntil(previous.from, prevDays)) * 100) / 100
}
