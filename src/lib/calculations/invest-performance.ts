import { buildPriceIndex, closeAt, eurPerUnit, monthKey, monthRange, rawCloseAt, shiftMonth } from "./invest-fx"
import type { MonthKey, PriceIndex } from "./invest-fx"
import { spanishSavingsTax } from "./invest-tax"
import type { InvestPosition, InvestPrice, InvestSettings } from "~/types/invest"

// Rentabilidad del satélite vs. benchmark (INVEST_SPEC.md §5.1), en EUR.
//
// El satélite arranca como caja = total_portfolio_value × satellite_pct al
// cierre del mes anterior a started_at (base 100). Valor a fin de mes:
// V = caja + Σ valor de las posiciones abiertas. Abrir y cerrar son
// movimientos internos (caja ↔ acciones), sin flujos externos:
// r = V_end / V_start − 1. Aperturas y cierres se pasan a EUR con el FX del
// cierre del mes en que ocurren (todo es cierre mensual, §9).
//
// Total return implícito: una posición vale
//   acciones × close(mes de apertura) × adj_close(m) / adj_close(mes de apertura)
// abierta o al cerrar. El primer tramo (compra → primer cierre mensual) va con
// el cierre real sin ajustar; desde ahí, la serie ajustada, que incluye los
// dividendos como el benchmark de acumulación. Los dividendos cobrados no se
// registran. El precio real de salida solo se usa para el P&L realizado y el
// impuesto (§5.2).
//
// Si falta un precio o un FX necesario, la serie se corta en el último mes
// completo: no se inventa un valor.

export type PerfPosition = Pick<
  InvestPosition,
  "ticker" | "openedAt" | "entryPrice" | "shares" | "feesOpen" | "closedAt" | "exitPrice" | "feesClose"
> & { currency: string | null }

export type SatelliteMonth = {
  monthEnd: string
  gross:    number   // sin comisiones ni impuestos
  netFees:  number   // con comisiones
  netTax:   number   // con comisiones e impuesto estimado (§5.2)
}

export type MonthlyReturn = {
  monthEnd: string
  ret:      number
}

/** Mes del cierre base (índice 100): el anterior a started_at. */
export function performanceBaseMonth(startedAt: string): MonthKey {
  return shiftMonth(monthKey(startedAt), -1)
}

type Ledger = { gross: number; netFees: number; netTax: number }

export function satelliteMonthlyReturns(
  positions: PerfPosition[],
  prices: InvestPrice[],
  settings: Pick<InvestSettings, "totalPortfolioValue" | "satellitePct" | "startedAt">,
  through: MonthKey,
): SatelliteMonth[] {
  const index = buildPriceIndex(prices)
  const base = performanceBaseMonth(settings.startedAt)
  // Lo anterior a la base se aplica en la base (entra en el valor inicial).
  const eventMonth = (d: string): MonthKey => (monthKey(d) < base ? base : monthKey(d))

  const start = settings.totalPortfolioValue * settings.satellitePct
  const cash: Ledger = { gross: start, netFees: start, netTax: start }
  const entries = new Map<PerfPosition, Entry>()
  const gainsByYear = new Map<string, number>()
  const taxByYear = new Map<string, number>()

  const out: SatelliteMonth[] = []
  let prev: Ledger | null = null

  for (const month of monthRange(base, through)) {
    const monthEnd = index.monthEnds.get(month)
    if (!monthEnd) break

    // Aperturas antes que cierres: una posición puede abrir y cerrar en el mismo mes.
    let missing = false
    for (const p of positions) {
      if (eventMonth(p.openedAt) !== month) continue
      const fx = eurPerUnit(p.currency, month, index)
      const anchor = closeAt(index, p.ticker, month)
      const rawOpen = rawCloseAt(index, p.ticker, month)
      if (fx == null || anchor == null || anchor <= 0 || rawOpen == null) { missing = true; break }
      const entry: Entry = { baseLocal: p.shares * rawOpen, costEur: p.shares * p.entryPrice * fx, anchor }
      entries.set(p, entry)
      cash.gross   -= entry.costEur
      cash.netFees -= entry.costEur + p.feesOpen
      cash.netTax  -= entry.costEur + p.feesOpen
    }
    if (missing) break

    for (const p of positions) {
      if (p.closedAt == null || p.exitPrice == null || eventMonth(p.closedAt) !== month) continue
      const entry = entries.get(p)
      const value = entry ? totalReturnValue(p, entry, month, index) : null
      const fx = eurPerUnit(p.currency, month, index)
      if (entry == null || value == null || fx == null) { missing = true; break }
      cash.gross   += value
      cash.netFees += value - p.feesClose
      cash.netTax  += value - p.feesClose

      // §5.2: impuesto sobre la ganancia real (precio de salida), recalculado
      // para el año tras cada cierre; se resta la diferencia.
      const proceeds = p.shares * p.exitPrice * fx
      const year = p.closedAt.slice(0, 4)
      const gains = (gainsByYear.get(year) ?? 0) + proceeds - entry.costEur - p.feesOpen - p.feesClose
      gainsByYear.set(year, gains)
      const tax = spanishSavingsTax(gains)
      cash.netTax -= tax - (taxByYear.get(year) ?? 0)
      taxByYear.set(year, tax)
    }
    if (missing) break

    let holdings = 0
    for (const p of positions) {
      const open = eventMonth(p.openedAt) <= month
      const closed = p.closedAt != null && eventMonth(p.closedAt) <= month
      if (!open || closed) continue
      const entry = entries.get(p)
      const value = entry ? totalReturnValue(p, entry, month, index) : null
      if (value == null) { missing = true; break }
      holdings += value
    }
    if (missing) break

    const value: Ledger = {
      gross:   cash.gross + holdings,
      netFees: cash.netFees + holdings,
      netTax:  cash.netTax + holdings,
    }
    if (prev) {
      out.push({
        monthEnd,
        gross:   value.gross / prev.gross - 1,
        netFees: value.netFees / prev.netFees - 1,
        netTax:  value.netTax / prev.netTax - 1,
      })
    }
    prev = value
  }
  return out
}

type Entry = {
  baseLocal: number   // acciones × close sin ajustar del mes de apertura, divisa de cotización
  costEur:   number   // coste real (precio de entrada) en EUR
  anchor:    number   // adj_close del mes de apertura
}

/** acciones × close(apertura) × adj(m) / adj(apertura), en EUR con el FX de m. */
function totalReturnValue(p: PerfPosition, entry: Entry, month: MonthKey, index: PriceIndex): number | null {
  const close = closeAt(index, p.ticker, month)
  const fx = eurPerUnit(p.currency, month, index)
  if (close == null || fx == null) return null
  return entry.baseLocal * (close / entry.anchor) * fx
}

/**
 * Rentabilidades mensuales del benchmark desde la base de started_at. El
 * benchmark se toma en su divisa (IWDA.AS cotiza en EUR). Se corta en el
 * primer mes sin cierre.
 */
export function benchmarkMonthlyReturns(
  prices: InvestPrice[],
  ticker: string,
  startedAt: string,
  through?: MonthKey,
): MonthlyReturn[] {
  const index = buildPriceIndex(prices)
  const base = performanceBaseMonth(startedAt)
  const last = through ?? [...(index.closes.get(ticker)?.keys() ?? [])].sort().at(-1)
  if (!last) return []

  const out: MonthlyReturn[] = []
  let prev = closeAt(index, ticker, base)
  if (prev == null) return []
  for (const month of monthRange(shiftMonth(base, 1), last)) {
    const close = closeAt(index, ticker, month)
    const monthEnd = index.monthEnds.get(month)
    if (close == null || !monthEnd) break
    out.push({ monthEnd, ret: close / prev - 1 })
    prev = close
  }
  return out
}

/** Índice encadenado: [base, base·(1+r1), base·(1+r1)(1+r2), …] (n + 1 puntos). */
export function chainReturns(returns: number[], base = 100): number[] {
  const out = [base]
  for (const r of returns) out.push(out[out.length - 1] * (1 + r))
  return out
}

// ── Informe de la pestaña Performance (§4.6) ─────────────────────────────────

/** "Month N of 36": mes del test (1 = el de started_at). */
export function testMonth(startedAt: string, today: string): number {
  const toIndex = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7))
  return toIndex(today) - toIndex(startedAt) + 1
}

export type ChartPoint = {
  monthEnd:  string
  satellite: number | null   // índice base 100, neto de comisiones e impuestos
  benchmark: number | null
}

export type PerformanceReport = {
  points:    ChartPoint[]
  months:    number           // meses comparados (periodo común)
  satellite: { gross: number; netFees: number; netTax: number }
  benchmark: number
  diff:      number           // satélite neto de impuestos − benchmark
}

/**
 * Compara satélite y benchmark sobre el periodo común (la serie más corta
 * manda). `baseMonthEnd` es el cierre base (índice 100); sin él no hay informe.
 */
export function buildPerformanceReport(
  satellite: SatelliteMonth[],
  benchmark: MonthlyReturn[],
  baseMonthEnd: string,
): PerformanceReport {
  const n = Math.min(satellite.length, benchmark.length)
  const sat = satellite.slice(0, n)
  const bench = benchmark.slice(0, n)
  const cum = (rs: number[]) => (chainReturns(rs).at(-1) ?? 100) / 100 - 1

  const satIndex = chainReturns(satellite.map(s => s.netTax))
  const benchIndex = chainReturns(benchmark.map(b => b.ret))
  const length = Math.max(satellite.length, benchmark.length)
  const points: ChartPoint[] = [{ monthEnd: baseMonthEnd, satellite: 100, benchmark: 100 }]
  for (let i = 0; i < length; i++) {
    points.push({
      monthEnd:  satellite[i]?.monthEnd ?? benchmark[i]!.monthEnd,
      satellite: satIndex[i + 1] ?? null,
      benchmark: benchIndex[i + 1] ?? null,
    })
  }

  const netTax = cum(sat.map(s => s.netTax))
  const benchCum = cum(bench.map(b => b.ret))
  return {
    points,
    months: n,
    satellite: {
      gross:   cum(sat.map(s => s.gross)),
      netFees: cum(sat.map(s => s.netFees)),
      netTax,
    },
    benchmark: benchCum,
    diff:      netTax - benchCum,
  }
}

/**
 * §4.6: % de meses con revisión. Cuentan los runs desde el cierre base (el
 * run del mes de started_at en adelante); revisado = hay fila en invest_reviews.
 */
export function reviewStats(
  runs: { id: string; runDate: string }[],
  reviewedRunIds: Set<string>,
  startedAt: string,
): { reviewed: number; total: number } {
  const base = performanceBaseMonth(startedAt)
  const counted = runs.filter(r => monthKey(r.runDate) >= base)
  return {
    reviewed: counted.filter(r => reviewedRunIds.has(r.id)).length,
    total:    counted.length,
  }
}
