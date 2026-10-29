// Comisiones estimadas (Trading). Cuando un trade llega sin comisión (el add-on
// de NinjaTrader o el CSV mandan 0 si la cuenta no tiene plantilla de
// comisiones), se estima con la tarifa ida y vuelta por contrato que el
// usuario configura para esa cuenta e instrumento.

export type CommissionRate = { instrument: string; roundTurn: number }   // $ por contrato, ida y vuelta

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Tarifa de un instrumento (por símbolo raíz: NQ, MNQ…); null si no hay. */
export function rateFor(rates: CommissionRate[], instrument: string): number | null {
  const key = instrument.trim().toUpperCase()
  return rates.find(r => r.instrument.toUpperCase() === key)?.roundTurn ?? null
}

/**
 * Comisión a aplicar a un trade, o null si no se toca: solo los que llegan sin
 * comisión (0) o con una estimada antes; una comisión real del bróker manda.
 */
export function estimatedCommission(
  trade: { instrument: string; contracts: number; commission: number; commissionEstimated: boolean },
  rates: CommissionRate[],
): number | null {
  if (trade.commission !== 0 && !trade.commissionEstimated) return null
  const rate = rateFor(rates, trade.instrument)
  if (rate == null) return null
  return round2(rate * Math.abs(trade.contracts))
}
