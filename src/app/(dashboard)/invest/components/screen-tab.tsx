import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import {
  getLatestRun,
  getPositions,
  getPricesFor,
  getScreenResult,
  getScreenResults,
  getThesisDrafts,
} from "~/services/queries/invest"
import { isCurrentMonthRun, openBlockers, positionsForLimits } from "~/lib/calculations/invest-run"
import { EUR_FX_TICKERS, buildPriceIndex, eurPerUnit, monthKey } from "~/lib/calculations/invest-fx"
import type { InvestSettings } from "~/types/invest"
import { RunSummary } from "./run-summary"
import { TickerSearch } from "./ticker-search"
import { PassingTable } from "./passing-table"
import type { OpenAction } from "./passing-table"
import { MarkReviewed } from "./mark-reviewed.client"

type Props = {
  query:    string | null
  settings: InvestSettings
}

export async function ScreenTab({ query, settings }: Props): Promise<ReactElement> {
  const runResult = await getLatestRun()
  if (!runResult.success) {
    return <div className="card p-4 text-sm text-loss">{INVEST.SCREEN.LOAD_ERROR}</div>
  }
  const run = runResult.data
  if (!run) {
    return <div className="card px-4 py-16 text-sm text-text-mute text-center">{INVEST.SCREEN.NO_RUN}</div>
  }

  const [passing, searched, positions, fx, drafts] = await Promise.all([
    getScreenResults(run.id, { passesOnly: true }),
    query ? getScreenResult(run.id, query) : Promise.resolve(null),
    getPositions(),
    // FX del mes del run para el importe sugerido en EUR (§5.3).
    getPricesFor([...new Set(Object.values(EUR_FX_TICKERS))], run.runDate),
    getThesisDrafts(),
  ])
  if (!passing.success || (searched && !searched.success) || !positions.success || !fx.success || !drafts.success) {
    return <div className="card p-4 text-sm text-loss">{INVEST.SCREEN.LOAD_ERROR}</div>
  }

  const today = new Date().toISOString().slice(0, 10)
  const isCurrent = isCurrentMonthRun(run.runDate, today)
  // §1.6: los límites se cuentan solo entre las posiciones del modo actual.
  const openPositions = positionsForLimits(positions.data, settings.paperMode)
  const fxIndex = buildPriceIndex(fx.data)
  const runMonth = monthKey(run.runDate)

  const actions: Record<string, OpenAction> = {}
  for (const r of passing.data) {
    actions[r.ticker] = {
      blockers: openBlockers({ isCurrentRun: isCurrent, candidate: r, openPositions, maxPositions: settings.maxPositions }),
      candidate: {
        ticker:              r.ticker,
        name:                r.name,
        currency:            r.currency,
        price:               r.price,
        runDate:             run.runDate,
        totalPortfolioValue: settings.totalPortfolioValue,
        positionPct:         settings.positionPct,
        eurPerUnit:          eurPerUnit(r.currency, runMonth, fxIndex),
        paper:               settings.paperMode,
        draft:               drafts.data[r.ticker] ?? null,
      },
    }
  }

  return (
    <>
      {isCurrent && <MarkReviewed runId={run.id} />}
      <RunSummary run={run} isCurrent={isCurrent} />
      <TickerSearch
        query={query}
        runDate={run.runDate}
        benchmark={run.benchmark}
        result={searched?.success ? searched.data : null}
      />
      <PassingTable rows={passing.data} actions={actions} />
    </>
  )
}
