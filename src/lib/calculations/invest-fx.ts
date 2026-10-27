import type { InvestPrice } from "~/types/invest"

// Divisa base EUR (INVEST_SPEC.md §5). El job guarda en invest_prices los
// cierres mensuales de EUR{divisa}=X (unidades de la divisa por 1 EUR). Mismo
// mapa que EUR_FX_TICKERS / PRICE_UNIT en scripts/screener/screener/yahoo.py.
export const EUR_FX_TICKERS: Record<string, string> = {
  USD: "EURUSD=X",
  GBP: "EURGBP=X",
  GBp: "EURGBP=X",
  CHF: "EURCHF=X",
  SEK: "EURSEK=X",
  DKK: "EURDKK=X",
  NOK: "EURNOK=X",
}

// Las cotizadas en Londres cotizan en peniques.
export const PRICE_UNIT: Record<string, number> = { GBp: 0.01 }

/** "YYYY-MM" */
export type MonthKey = string

export function monthKey(isoDate: string): MonthKey {
  return isoDate.slice(0, 7)
}

export function shiftMonth(key: MonthKey, months: number): MonthKey {
  const [y, m] = key.split("-").map(Number)
  const total = y * 12 + (m - 1) + months
  const year = Math.floor(total / 12)
  const month = total - year * 12 + 1
  return `${year}-${String(month).padStart(2, "0")}`
}

/** Meses de `from` a `to`, ambos incluidos. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = []
  for (let m = from; m <= to; m = shiftMonth(m, 1)) out.push(m)
  return out
}

export type PriceIndex = {
  closes:    Map<string, Map<MonthKey, number>>   // ticker → mes → adj_close
  rawCloses: Map<string, Map<MonthKey, number>>   // ticker → mes → close sin ajustar
  monthEnds: Map<MonthKey, string>                // mes → month_end (último día hábil)
}

export function buildPriceIndex(prices: InvestPrice[]): PriceIndex {
  const closes = new Map<string, Map<MonthKey, number>>()
  const rawCloses = new Map<string, Map<MonthKey, number>>()
  const monthEnds = new Map<MonthKey, string>()
  const put = (map: Map<string, Map<MonthKey, number>>, ticker: string, key: MonthKey, v: number) => {
    let byMonth = map.get(ticker)
    if (!byMonth) map.set(ticker, (byMonth = new Map()))
    byMonth.set(key, v)
  }
  for (const p of prices) {
    const key = monthKey(p.monthEnd)
    put(closes, p.ticker, key, p.adjClose)
    if (p.close != null) put(rawCloses, p.ticker, key, p.close)
    monthEnds.set(key, p.monthEnd)
  }
  return { closes, rawCloses, monthEnds }
}

/** adj_close del mes. */
export function closeAt(index: PriceIndex, ticker: string, month: MonthKey): number | null {
  return index.closes.get(ticker)?.get(month) ?? null
}

/** Cierre sin ajustar del mes (null en filas anteriores a la columna close). */
export function rawCloseAt(index: PriceIndex, ticker: string, month: MonthKey): number | null {
  return index.rawCloses.get(ticker)?.get(month) ?? null
}

/**
 * EUR por 1 unidad de precio cotizado en `currency` al cierre de `month`.
 * null si la divisa es desconocida o falta el cierre del par: no se valora.
 */
export function eurPerUnit(currency: string | null, month: MonthKey, index: PriceIndex): number | null {
  if (currency === "EUR") return 1
  if (currency == null) return null
  const pair = EUR_FX_TICKERS[currency]
  if (!pair) return null
  const rate = closeAt(index, pair, month)
  if (rate == null || rate <= 0) return null
  return (PRICE_UNIT[currency] ?? 1) / rate
}
