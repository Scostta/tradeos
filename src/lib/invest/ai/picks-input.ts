import { MAX_OPEN_PER_SECTOR } from "~/lib/calculations/invest-run"
import type { InvestPositionWithMeta, InvestSettings, ScreenResult, ScreenRun } from "~/types/invest"

// INVEST_SPEC §4.8: lo que se envía a la IA para comentar un run. Solo los
// tickers que pasan, con sus cifras del screener; orden fijo y valores
// redondeados para que el hash decida si el comentario guardado sigue valiendo.

const r = (n: number | null, digits = 4): number | null => (n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits)

export type PicksInput = ReturnType<typeof picksInput>

export function picksInput(run: ScreenRun, passers: ScreenResult[], open: InvestPositionWithMeta[], settings: InvestSettings) {
  return {
    runDate:   run.runDate,
    benchmark: run.benchmark,
    rules:     { maxPositions: settings.maxPositions, maxPerSector: MAX_OPEN_PER_SECTOR },
    openPositions: open
      .filter(p => p.closedAt == null)
      .map(p => ({ ticker: p.ticker, sector: p.sector, paper: p.paper }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker)),
    passers: [...passers]
      .sort((a, b) => a.ticker.localeCompare(b.ticker))
      .map(p => ({
        ticker: p.ticker, name: p.name, sector: p.sector, marketCapUsdBn: r(p.marketCap == null ? null : p.marketCap / 1e9, 1),
        revenueGrowthYoy: r(p.revenueGrowthYoy), fcfMargin: r(p.fcfMargin), grossMargin: r(p.grossMargin),
        grossMarginPrevYear: r(p.grossMarginPrev), netDebtEbitda: r(p.netDebtEbitda, 2), roic: r(p.roic),
        priceVsSma10m: p.price != null && p.sma10m ? r(p.price / p.sma10m - 1) : null,
        momentum12_1: r(p.momentum121), relStrength6m: r(p.relStrength6m), monthsListed: p.monthsListed,
      })),
  }
}
