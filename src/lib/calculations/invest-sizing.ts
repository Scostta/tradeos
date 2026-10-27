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
