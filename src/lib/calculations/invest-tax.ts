// Estimación del IRPF de la base del ahorro (INVEST_SPEC.md §5.2). Se etiqueta
// en la UI como estimación: no hay arrastre de pérdidas entre años ni otras
// rentas del ahorro.

const BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 6_000,    rate: 0.19 },
  { upTo: 50_000,   rate: 0.21 },
  { upTo: 200_000,  rate: 0.23 },
  { upTo: 300_000,  rate: 0.27 },
  { upTo: Infinity, rate: 0.28 },
]

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Impuesto de una ganancia neta anual en EUR. Una pérdida neta tributa 0. */
export function spanishSavingsTax(netGain: number): number {
  let tax = 0
  let floor = 0
  for (const { upTo, rate } of BRACKETS) {
    if (netGain <= floor) break
    tax += (Math.min(netGain, upTo) - floor) * rate
    floor = upTo
  }
  return round2(tax)
}

export type CapitalGainsTax = {
  byYear: Record<string, number>
  total:  number
}

/** realizedGainsByYear: { "2026": suma de ganancias y pérdidas realizadas ese año, en EUR }. */
export function estimateSpanishCapitalGainsTax(
  realizedGainsByYear: Record<string, number>,
): CapitalGainsTax {
  const byYear: Record<string, number> = {}
  let total = 0
  for (const [year, gain] of Object.entries(realizedGainsByYear)) {
    byYear[year] = spanishSavingsTax(gain)
    total += byYear[year]
  }
  return { byYear, total: round2(total) }
}
