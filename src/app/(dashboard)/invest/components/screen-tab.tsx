import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { getLatestRun, getScreenResult, getScreenResults } from "~/services/queries/invest"
import { isCurrentMonthRun } from "~/lib/calculations/invest-run"
import { RunSummary } from "./run-summary"
import { TickerSearch } from "./ticker-search"
import { PassingTable } from "./passing-table"

export async function ScreenTab({ query }: { query: string | null }): Promise<ReactElement> {
  const runResult = await getLatestRun()
  if (!runResult.success) {
    return <div className="card p-4 text-sm text-loss">{INVEST.SCREEN.LOAD_ERROR}</div>
  }
  const run = runResult.data
  if (!run) {
    return <div className="card px-4 py-16 text-sm text-text-mute text-center">{INVEST.SCREEN.NO_RUN}</div>
  }

  const [passing, searched] = await Promise.all([
    getScreenResults(run.id, { passesOnly: true }),
    query ? getScreenResult(run.id, query) : Promise.resolve(null),
  ])
  if (!passing.success || (searched && !searched.success)) {
    return <div className="card p-4 text-sm text-loss">{INVEST.SCREEN.LOAD_ERROR}</div>
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <RunSummary run={run} isCurrent={isCurrentMonthRun(run.runDate, today)} />
      <TickerSearch
        query={query}
        runDate={run.runDate}
        benchmark={run.benchmark}
        result={searched?.success ? searched.data : null}
      />
      <PassingTable rows={passing.data} />
    </>
  )
}
