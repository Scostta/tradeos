import type { InvestSettings } from "~/types/invest"

export type PositionSize = {
  amount: number   // EUR
  shares: number
}

/**
 * Tamaño objetivo (§1.4, §5.3): total_portfolio_value × position_pct en EUR y
 * shares = floor(amount / precio en EUR). `eurPerUnit` pasa el precio cotizado
 * a EUR (1 para EUR; ver eurPerUnit en invest-fx.ts).
 */
export function suggestedPositionSize(
  settings: Pick<InvestSettings, "totalPortfolioValue" | "positionPct">,
  price: number,
  eurPerUnit = 1,
): PositionSize {
  const amount = Math.round(settings.totalPortfolioValue * settings.positionPct * 100) / 100
  const priceEur = price * eurPerUnit
  // + 1e-9: 4000 / 0.1 no debe quedarse en 39 999 por redondeo binario.
  const shares = priceEur > 0 ? Math.floor(amount / priceEur + 1e-9) : 0
  return { amount, shares }
}

export type SizeWarning = {
  kind: "one_share_above" | "over" | "under"
  pct:  number | null   // coste (o una acción, si aún no hay coste) / patrimonio total
}

/**
 * Aviso (no bloquea) cuando el tamaño se aleja del objetivo de §1.4:
 * - one_share_above: una sola acción ya cuesta más que el importe objetivo.
 * - over: el coste supera el importe objetivo.
 * - under: cabría al menos una acción más sin pasarse.
 * null si cuadra o faltan datos (precio o FX).
 */
export function positionSizeWarning(args: {
  amount:              number
  totalPortfolioValue: number
  priceEur:            number | null
  costEur:             number | null
}): SizeWarning | null {
  const { amount, totalPortfolioValue, priceEur, costEur } = args
  const pct = (eur: number) => (totalPortfolioValue > 0 ? eur / totalPortfolioValue : null)
  if (priceEur == null || priceEur <= 0) return null
  // + 0.005: un céntimo de redondeo no cuenta como pasarse.
  if (priceEur > amount + 0.005) return { kind: "one_share_above", pct: pct(costEur ?? priceEur) }
  if (costEur == null) return null
  if (costEur > amount + 0.005) return { kind: "over", pct: pct(costEur) }
  if (costEur + priceEur <= amount + 0.005) return { kind: "under", pct: pct(costEur) }
  return null
}
