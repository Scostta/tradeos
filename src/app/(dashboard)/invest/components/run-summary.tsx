import type { ReactElement, ReactNode } from "react"
import { INVEST } from "~/constants/copies/invest"
import type { ScreenRun } from "~/types/invest"
import { fmtDay } from "./invest-format"

type Props = {
  run:        ScreenRun
  isCurrent:  boolean
}

function Stat({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="label-caps">{label}</span>
      <span className="mono text-lg text-text">{children}</span>
    </div>
  )
}

export function RunSummary({ run, isCurrent }: Props): ReactElement {
  return (
    <div className="card">
      <div className="grid grid-cols-2 md:grid-cols-5 divide-border md:divide-x">
        <Stat label={INVEST.SCREEN.LAST_RUN}>{fmtDay(run.runDate)}</Stat>
        <Stat label={INVEST.SCREEN.UNIVERSE}>{run.universeSize}</Stat>
        <Stat label={INVEST.SCREEN.PASSING}>
          <span className="text-accent">{run.passedCount}</span>
        </Stat>
        <Stat label={INVEST.SCREEN.CURRENT_RUN}>
          <span className={isCurrent ? "text-profit" : "text-loss"}>
            {isCurrent ? INVEST.SCREEN.YES : INVEST.SCREEN.NO}
          </span>
        </Stat>
        <Stat label={INVEST.SCREEN.BENCHMARK}>{run.benchmark}</Stat>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-t border-border text-sm text-text-mute">
        <span className="mono">
          {INVEST.SCREEN.EXECUTED} {fmtDay(run.executedAt)} · {run.jobVersion.slice(0, 7)}
        </span>
        {!isCurrent && <span className="text-loss">{INVEST.SCREEN.NO_CURRENT_RUN_HINT}</span>}
      </div>
    </div>
  )
}
