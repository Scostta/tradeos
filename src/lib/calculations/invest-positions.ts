import { EUR_FX_TICKERS, PRICE_UNIT, closeAt, monthKey } from "./invest-fx"
import type { MonthKey, PriceIndex } from "./invest-fx"
import { spanishSavingsTax } from "./invest-tax"
import type { InvestPosition } from "~/types/invest"

// Valoración en EUR de la pestaña Positions (INVEST_SPEC.md §4.3, §5).

export type ValuedPosition = Pick<
  InvestPosition,
  "id" | "ticker" | "openedAt" | "entryPrice" | "shares" | "feesOpen" | "closedAt" | "exitPrice" | "feesClose"
> & { currency: string | null }

/** Último mes con cierre de `ticker` en invest_prices. */
export function lastMonthOf(index: PriceIndex, ticker: string): MonthKey | null {
  const months = index.closes.get(ticker)
  if (!months || months.size === 0) return null
  return [...months.keys()].sort().at(-1) ?? null
}

/**
 * EUR por unidad de precio con el último cierre del par en `month` o antes.
 * Para mostrar posiciones del mes en curso, cuyo cierre de FX aún no existe
 * (lo escribe el job del mes siguiente). El rendimiento (§5.1) no lo usa: allí
 * cada mes se valora con su propio cierre.
 */
export function eurPerUnitAtOrBefore(currency: string | null, month: MonthKey, index: PriceIndex): number | null {
  if (currency === "EUR") return 1
  if (currency == null) return null
  const pair = EUR_FX_TICKERS[currency]
  const rates = pair ? index.closes.get(pair) : undefined
  if (!rates) return null
  const at = [...rates.keys()].filter(m => m <= month).sort().at(-1)
  const rate = at ? rates.get(at) : undefined
  if (rate == null || rate <= 0) return null
  return (PRICE_UNIT[currency] ?? 1) / rate
}

export type OpenValuation = {
  costEur:   number | null
  lastPrice: number | null      // adj close del último mes, divisa de cotización
  lastMonth: MonthKey | null
  valueEur:  number | null
  pnlEur:    number | null      // latente, sin comisiones
  pnlPct:    number | null
}

export function valueOpenPosition(p: ValuedPosition, index: PriceIndex): OpenValuation {
  const fxOpen = eurPerUnitAtOrBefore(p.currency, monthKey(p.openedAt), index)
  const costEur = fxOpen == null ? null : p.shares * p.entryPrice * fxOpen
  const lastMonth = lastMonthOf(index, p.ticker)
  const lastPrice = lastMonth ? closeAt(index, p.ticker, lastMonth) : null
  const fxLast = lastMonth ? eurPerUnitAtOrBefore(p.currency, lastMonth, index) : null
  const valueEur = lastPrice != null && fxLast != null ? p.shares * lastPrice * fxLast : null
  const pnlEur = valueEur != null && costEur != null ? valueEur - costEur : null
  return {
    costEur,
    lastPrice,
    lastMonth,
    valueEur,
    pnlEur,
    pnlPct: pnlEur != null && costEur ? pnlEur / costEur : null,
  }
}

export type ClosedResult = {
  costEur:     number
  proceedsEur: number
  grossPnlEur: number   // sin comisiones
  feesEur:     number   // apertura + cierre (EUR)
  netPnlEur:   number   // base del impuesto
}

/** null si falta el FX del mes de apertura o de cierre. */
export function closedPositionResult(p: ValuedPosition, index: PriceIndex): ClosedResult | null {
  if (p.closedAt == null || p.exitPrice == null) return null
  const fxOpen = eurPerUnitAtOrBefore(p.currency, monthKey(p.openedAt), index)
  const fxClose = eurPerUnitAtOrBefore(p.currency, monthKey(p.closedAt), index)
  if (fxOpen == null || fxClose == null) return null
  const costEur = p.shares * p.entryPrice * fxOpen
  const proceedsEur = p.shares * p.exitPrice * fxClose
  const feesEur = p.feesOpen + p.feesClose
  return {
    costEur,
    proceedsEur,
    grossPnlEur: proceedsEur - costEur,
    feesEur,
    netPnlEur: proceedsEur - costEur - feesEur,
  }
}

/**
 * Impuesto estimado atribuido a cada cierre (§5.2): los cierres de cada año
 * en orden cronológico; cada uno se lleva lo que añade al impuesto del año
 * (negativo si una pérdida devuelve parte). Mismo criterio que netTax (§5.1).
 */
export function estimatedTaxByClose(
  closes: { id: string; closedAt: string; netPnlEur: number }[],
): Map<string, number> {
  const out = new Map<string, number>()
  const sorted = [...closes].sort((a, b) => a.closedAt.localeCompare(b.closedAt) || a.id.localeCompare(b.id))
  const gains = new Map<string, number>()
  const taxed = new Map<string, number>()
  for (const c of sorted) {
    const year = c.closedAt.slice(0, 4)
    const total = (gains.get(year) ?? 0) + c.netPnlEur
    gains.set(year, total)
    const tax = spanishSavingsTax(total)
    out.set(c.id, Math.round((tax - (taxed.get(year) ?? 0)) * 100) / 100)
    taxed.set(year, tax)
  }
  return out
}
