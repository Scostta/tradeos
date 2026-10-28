import { getLatestChecks, getPositions, getPricesFor } from "~/services/queries/invest"
import type { LatestCheck } from "~/services/queries/invest"
import { EUR_FX_TICKERS, buildPriceIndex, monthKey, shiftMonth } from "~/lib/calculations/invest-fx"
import {
  closedPositionResult,
  estimatedTaxByClose,
  valueOpenPosition,
} from "~/lib/calculations/invest-positions"
import type { ClosedResult, OpenValuation } from "~/lib/calculations/invest-positions"
import type { InvestPositionWithMeta } from "~/types/invest"

export type OpenRow = {
  position:  InvestPositionWithMeta
  valuation: OpenValuation
  check:     LatestCheck | null
}

export type ClosedRow = {
  position: InvestPositionWithMeta
  result:   ClosedResult | null    // null: falta FX
  tax:      number | null
}

export type PositionsData = { open: OpenRow[]; closed: ClosedRow[] }

/**
 * Abiertas valoradas (P&L latente con el último close) y cerradas con su
 * resultado e impuesto estimado (§5.2). El impuesto depende de todos los
 * cierres del año, así que se calcula siempre sobre todas las posiciones,
 * también en la página de un solo ticker. null si falla alguna carga.
 */
export async function loadPositionsData(): Promise<PositionsData | null> {
  const positionsResult = await getPositions()
  if (!positionsResult.success) return null
  const positions = positionsResult.data
  const open = positions.filter(p => p.closedAt == null)
  const closed = positions.filter(p => p.closedAt != null)

  // Precios de los tickers + pares FX desde un mes antes de la primera apertura
  // (el FX de un mes aún abierto es el del cierre anterior).
  const earliest = positions.map(p => p.openedAt).sort()[0]
  const from = earliest ? `${shiftMonth(monthKey(earliest), -1)}-01` : null
  const [checksResult, pricesResult] = await Promise.all([
    getLatestChecks(open.map(p => p.id)),
    from
      ? getPricesFor([...positions.map(p => p.ticker), ...Object.values(EUR_FX_TICKERS)], from)
      : Promise.resolve({ success: true as const, data: [] }),
  ])
  if (!checksResult.success || !pricesResult.success) return null
  const index = buildPriceIndex(pricesResult.data)

  const closedResults = closed.map(p => ({ position: p, result: closedPositionResult(p, index) }))
  const taxes = estimatedTaxByClose(
    closedResults
      .filter(c => c.result != null)
      .map(c => ({ id: c.position.id, closedAt: c.position.closedAt as string, netPnlEur: c.result!.netPnlEur })),
  )

  return {
    open: open.map(p => ({
      position:  p,
      valuation: valueOpenPosition(p, index),
      check:     checksResult.data[p.id] ?? null,
    })),
    closed: closedResults
      .map(c => ({ ...c, tax: taxes.get(c.position.id) ?? null }))
      .sort((a, b) => (b.position.closedAt ?? "").localeCompare(a.position.closedAt ?? "")),
  }
}
