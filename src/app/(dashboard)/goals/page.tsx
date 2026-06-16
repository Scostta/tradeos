import type { ReactElement } from "react"
import { getGoalsOverview } from "~/services/queries/goals"
import { GOALS } from "~/constants/copies/goals"
import { GoalsCard } from "~/components/goals/goals-card.client"

export default async function GoalsPage(): Promise<ReactElement> {
  const result = await getGoalsOverview()
  const sets = result.success ? result.data.sets : []

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{GOALS.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{GOALS.PAGE_SUBTITLE}</div>
        </div>
      </header>

      <div className="flex-1 overflow-auto page-pad flex flex-col gap-4">
        {result.success ? (
          sets.map(set => (
            <GoalsCard key={set.scope.accountId ?? "global"} set={set} />
          ))
        ) : (
          <div className="card p-4 text-sm text-loss">{GOALS.EDITOR.ERROR}</div>
        )}
      </div>
    </div>
  )
}
