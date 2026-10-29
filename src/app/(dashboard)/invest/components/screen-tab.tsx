import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { aiConfigured, inputHash } from "~/lib/ai/claude-json"
import { picksContentSchema } from "~/lib/invest/ai/picks"
import { picksInput } from "~/lib/invest/ai/picks-input"
import { getInvestAiNote, getLatestRun, getPositions, getScreenResult, getScreenResults, getThesisDrafts } from "~/services/queries/invest"
import type { InvestSettings } from "~/types/invest"
import { RunSummary } from "./run-summary"
import { TickerSearch } from "./ticker-search"
import { PassingTable } from "./passing-table"
import { loadOpenContext, openActionFor } from "./open-action"
import type { OpenAction } from "./open-action"
import { MarkReviewed } from "./mark-reviewed.client"
import { AiPicksCard } from "./ai-picks-card.client"
import { ScreenGlance } from "./screen-glance"

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

  // Sectores de los que pasan, de más a menos (colores estables en la página).
  const sectorCount = new Map<string, number>()
  for (const r of passing.data) if (r.sector) sectorCount.set(r.sector, (sectorCount.get(r.sector) ?? 0) + 1)
  const sectorOrder = [...sectorCount.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)

  // §4.8: comentario de la IA guardado; "stale" si el run o las posiciones cambiaron.
  let aiCard: ReactElement | null = null
  let aiTickers: string[] = []
  if (aiConfigured() && passing.data.length > 0) {
    const [note, positions] = await Promise.all([getInvestAiNote("picks", run.id, null), getPositions()])
    const content = note.success && note.data ? picksContentSchema.safeParse(note.data.content) : null
    const initial = content?.success && note.success && note.data ? { content: content.data, createdAt: note.data.createdAt } : null
    const stale = initial != null && positions.success
      && note.success && note.data?.inputHash !== await inputHash(picksInput(run, passing.data, positions.data, settings))
    aiTickers = initial?.content.highlights.map(h => h.ticker) ?? []
    aiCard = <AiPicksCard runId={run.id} initial={initial} stale={stale} results={passing.data} sectorOrder={sectorOrder} />
  }

  return (
    <>
      {openCtx.isCurrent && <MarkReviewed runId={run.id} />}
      <RunSummary run={run} isCurrent={openCtx.isCurrent} />
      <ScreenGlance passers={passing.data} open={openCtx.openPositions} maxPositions={settings.maxPositions} sectorOrder={sectorOrder} />
      {aiCard}
      <TickerSearch
        query={query}
        runDate={run.runDate}
        benchmark={run.benchmark}
        result={searched?.success ? searched.data : null}
      />
      <PassingTable rows={passing.data} actions={actions} aiTickers={aiTickers} />
    </>
  )
}
