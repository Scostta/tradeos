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

// §1.4 / §4.4: por qué no se puede abrir una posición. Lo usan el botón de la
// tabla (tooltip) y openInvestPosition (validación en servidor).
export type OpenBlocker =
  | "NO_CURRENT_RUN"
  | "NOT_APPROVED"
  | "ALREADY_OPEN"
  | "MAX_POSITIONS"
  | "SECTOR_LIMIT"

export const MAX_OPEN_PER_SECTOR = 2

export function openBlockers(args: {
  isCurrentRun:  boolean
  candidate:     { ticker: string; passes: boolean; sector: string | null }
  openPositions: { ticker: string; sector: string | null }[]
  maxPositions:  number
}): OpenBlocker[] {
  const { isCurrentRun, candidate, openPositions, maxPositions } = args
  const out: OpenBlocker[] = []
  if (!isCurrentRun) out.push("NO_CURRENT_RUN")
  if (!candidate.passes) out.push("NOT_APPROVED")
  if (openPositions.some(p => p.ticker === candidate.ticker)) out.push("ALREADY_OPEN")
  if (openPositions.length >= maxPositions) out.push("MAX_POSITIONS")
  // Un sector null cuenta como un sector más (INVEST_SPEC.md §1.4).
  const sameSector = openPositions.filter(p => p.sector === candidate.sector).length
  if (sameSector >= MAX_OPEN_PER_SECTOR) out.push("SECTOR_LIMIT")
  return out
}

// ── Papel (INVEST_SPEC.md §1.6) ──────────────────────────────────────────────

/**
 * Posiciones abiertas que cuentan para los límites de apertura (máx.
 * posiciones, sector, ticker repetido): solo las del modo actual. En modo
 * papel, las de papel; en modo real, las reales (las de papel que sigan
 * abiertas no cuentan).
 */
export function positionsForLimits<T extends { paper: boolean; closedAt: string | null }>(
  positions: T[],
  paperMode: boolean,
): T[] {
  return positions.filter(p => p.closedAt == null && p.paper === paperMode)
}

/** started_at tras abrir una posición: solo lo fija la primera con paper = false. */
export function startedAtAfterOpen(current: string | null, paper: boolean, openedAt: string): string | null {
  return paper || current != null ? current : openedAt
}
