import type { FundamentalsYear, InvestPositionWithMeta, PositionCheck, ScreenResult, ScreenRun } from "~/types/invest"

// INVEST_SPEC §4.8: lo que se envía a la IA para revisar los falsadores de una
// posición abierta. Orden fijo y valores redondeados (el hash decide si la
// revisión guardada sigue valiendo).

const r = (n: number | null, digits = 4): number | null => (n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits)

export type ReviewInput = ReturnType<typeof reviewInput>

export function reviewInput(args: {
  run:          ScreenRun
  position:     InvestPositionWithMeta
  result:       ScreenResult | null                     // la fila del ticker en el run vigente
  checks:       (PositionCheck & { runDate: string })[]
  fundamentals: FundamentalsYear[]
}) {
  const { run, position: p, result, checks, fundamentals } = args
  return {
    runDate: run.runDate,
    position: {
      ticker: p.ticker, name: p.name, sector: p.sector, quoteCurrency: p.currency, paper: p.paper,
      openedAt: p.openedAt, entryPrice: p.entryPrice, thesis: p.thesis,
      falsifiers: p.falsifiers.map((text, i) => ({ index: i, text, userStatus: p.falsifierStatus[i] ?? "ok" })),
    },
    latestScreen: result && {
      passes: result.passes, failReasons: result.failReasons, price: result.price, sma10Months: result.sma10m,
      revenueGrowthYoy: r(result.revenueGrowthYoy), fcfMargin: r(result.fcfMargin), grossMargin: r(result.grossMargin),
      grossMarginPrevYear: r(result.grossMarginPrev), netDebtEbitda: r(result.netDebtEbitda, 2), roic: r(result.roic),
      momentum12_1: r(result.momentum121), relStrength6m: r(result.relStrength6m),
    },
    monthlyChecks: [...checks]
      .sort((a, b) => a.runDate.localeCompare(b.runDate))
      .map(c => ({ runDate: c.runDate, price: c.price, sma10Months: c.sma10m, signal: c.signal })),
    fundamentals: [...fundamentals]
      .sort((a, b) => a.fiscalYear - b.fiscalYear)
      .map(y => ({ fiscalYear: y.fiscalYear, revenue: y.revenue, grossMargin: r(y.grossMargin), fcf: y.fcf, roic: r(y.roic), netDebtEbitda: r(y.netDebtEbitda, 2) })),
  }
}
