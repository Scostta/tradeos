import { buildPriceIndex, closeAt, monthKey, monthRange, shiftMonth } from "./invest-fx"
import type { MonthKey } from "./invest-fx"
import { MIN_FALSIFIERS, THESIS_PROMPT_KEYS } from "~/types/invest"
import type { FundamentalsYear, InvestPrice, ThesisAnswers, ThesisPromptKey } from "~/types/invest"

// Página de detalle /invest/[ticker] (INVEST_SPEC.md §4.7). Solo para mostrar
// y para ayudar a escribir la tesis: no decide nada. La SMA de 10 meses del
// gráfico es la línea de referencia visual; la regla (price > sma10m) la
// evalúa el job y su resultado se lee de invest_screen_results.

export const CHART_MONTHS = 36
const SMA_MONTHS = 10

export type PricePoint = {
  month:    MonthKey
  monthEnd: string
  close:    number          // adj_close
  sma10:    number | null   // media de los 10 últimos adj_close; null si faltan meses
  relative: number | null   // (precio / benchmark) indexado a 100 en el primer mes con ambos
}

/** Últimos 36 meses de `ticker` con su SMA 10 y el ratio contra el benchmark. */
export function priceChartSeries(prices: InvestPrice[], ticker: string, benchmark: string): PricePoint[] {
  const index = buildPriceIndex(prices)
  const months = [...(index.closes.get(ticker)?.keys() ?? [])].sort()
  const last = months.at(-1)
  if (!last) return []

  const out: PricePoint[] = []
  let base: number | null = null
  for (const month of monthRange(shiftMonth(last, -(CHART_MONTHS - 1)), last)) {
    const close = closeAt(index, ticker, month)
    const monthEnd = index.monthEnds.get(month)
    if (close == null || !monthEnd) continue

    const window = monthRange(shiftMonth(month, -(SMA_MONTHS - 1)), month).map(m => closeAt(index, ticker, m))
    const sma10 = window.every(v => v != null) ? (window as number[]).reduce((a, v) => a + v, 0) / SMA_MONTHS : null

    const bench = closeAt(index, benchmark, month)
    let relative: number | null = null
    if (bench != null && bench > 0) {
      const ratio = close / bench
      if (base == null) base = ratio
      relative = (ratio / base) * 100
    }
    out.push({ month, monthEnd, close, sma10, relative })
  }
  return out
}

export type FundamentalsRow = FundamentalsYear & {
  revenueYoY:       number | null   // variación interanual
  fcfYoY:           number | null
  grossMarginDelta: number | null   // diferencia en puntos (fracción) vs. año anterior
  roicDelta:        number | null
}

function yoy(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev <= 0) return null
  return cur / prev - 1
}

function delta(cur: number | null, prev: number | null): number | null {
  return cur == null || prev == null ? null : cur - prev
}

/** Años del más reciente al más antiguo, con la variación contra el año anterior. */
export function fundamentalsWithChanges(rows: FundamentalsYear[]): FundamentalsRow[] {
  const sorted = [...rows].sort((a, b) => b.fiscalYear - a.fiscalYear)
  return sorted.map(row => {
    const prev = sorted.find(r => r.fiscalYear === row.fiscalYear - 1) ?? null
    return {
      ...row,
      revenueYoY:       yoy(row.revenue, prev?.revenue ?? null),
      fcfYoY:           yoy(row.fcf, prev?.fcf ?? null),
      grossMarginDelta: delta(row.grossMargin, prev?.grossMargin ?? null),
      roicDelta:        delta(row.roic, prev?.roic ?? null),
    }
  })
}

/**
 * Precarga del modal "Open position" desde el borrador: la tesis con las
 * cuatro respuestas (con su pregunta delante) y como falsadores las respuestas
 * 2 (qué lo pararía) y 4 (qué dato lo desmentiría). La validación del modal no
 * cambia: si no llegan a los mínimos, el usuario tiene que completarlos.
 */
export function thesisFromDraft(
  answers: ThesisAnswers,
  labels: Record<ThesisPromptKey, string>,
): { thesis: string; falsifiers: string[] } {
  const thesis = THESIS_PROMPT_KEYS
    .filter(k => answers[k].trim() !== "")
    .map(k => `${labels[k]}\n${answers[k].trim()}`)
    .join("\n\n")
  const falsifiers = [answers.stopper.trim(), answers.signal.trim()]
  while (falsifiers.length < MIN_FALSIFIERS) falsifiers.push("")
  return { thesis, falsifiers }
}

/** Mes "YYYY-MM" desde el que pedir precios para el gráfico. */
export function chartFrom(today: string): string {
  return `${shiftMonth(monthKey(today), -(CHART_MONTHS + 1))}-01`
}
