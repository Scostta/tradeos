import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { getLatestRun, getScreenResult, getScreenResults, getThesisDrafts } from "~/services/queries/invest"
import type { InvestSettings } from "~/types/invest"
import { RunSummary } from "./run-summary"
import { TickerSearch } from "./ticker-search"
import { PassingTable } from "./passing-table"
import { loadOpenContext, openActionFor } from "./open-action"
import type { OpenAction } from "./open-action"
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

  const [passing, searched, openCtx, drafts] = await Promise.all([
    getScreenResults(run.id, { passesOnly: true }),
    query ? getScreenResult(run.id, query) : Promise.resolve(null),
    loadOpenContext(run, settings),
    getThesisDrafts(),
  ])
  if (!passing.success || (searched && !searched.success) || !openCtx || !drafts.success) {
    return <div className="card p-4 text-sm text-loss">{INVEST.SCREEN.LOAD_ERROR}</div>
  }

  const actions: Record<string, OpenAction> = {}
  for (const r of passing.data) {
    actions[r.ticker] = openActionFor(openCtx, r, drafts.data[r.ticker] ?? null)
  }

  return (
    <>
      {openCtx.isCurrent && <MarkReviewed runId={run.id} />}
      <RunSummary run={run} isCurrent={openCtx.isCurrent} />
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
