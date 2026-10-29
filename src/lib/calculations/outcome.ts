import type { Trade } from "~/types/trade"

export type TradeOutcome = "win" | "loss" | "be"

type OutcomeFields = Pick<Trade, "netPnl" | "breakEven">

// Resultado de un trade para las estadísticas. Un BE (break_even, ver la
// migración 20261105130000) suma en el P&L pero no es ganador ni perdedor.
export function tradeOutcome(t: OutcomeFields): TradeOutcome {
  if (t.breakEven) return "be"
  return t.netPnl > 0 ? "win" : "loss"
}

export const isWin  = (t: OutcomeFields): boolean => tradeOutcome(t) === "win"
export const isLoss = (t: OutcomeFields): boolean => tradeOutcome(t) === "loss"
