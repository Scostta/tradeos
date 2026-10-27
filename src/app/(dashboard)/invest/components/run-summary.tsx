import type { ReactElement, ReactNode } from "react"
import { INVEST } from "~/constants/copies/invest"
import { CircleInfoIcon } from "~/lib/ui/icons/circle-info-icon"
import type { ScreenRun } from "~/types/invest"
import { cn } from "~/utils/cn"
import { fmtDay } from "./invest-format"

const S = INVEST.SCREEN

type Props = {
  run:       ScreenRun
  isCurrent: boolean
}

function Tile({ label, hint, children, sub }: {
  label:    string
  hint?:    string
  children: ReactNode
  sub:      ReactNode
}): ReactElement {
  return (
    <div className="card flex flex-col gap-2 px-4 py-3.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="label-caps">{label}</span>
        {hint && (
          <span className="text-text-mute cursor-help" title={hint} aria-label={hint}>
            <CircleInfoIcon />
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 min-w-0">{children}</div>
      <div className="text-sm text-text-mute">{sub}</div>
    </div>
  )
}

export function RunSummary({ run, isCurrent }: Props): ReactElement {
  const share = run.universeSize > 0 ? run.passedCount / run.universeSize : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <Tile
        label={S.LAST_RUN}
        sub={<span className="mono">{S.EXECUTED} {fmtDay(run.executedAt)} · {run.jobVersion.slice(0, 7)}</span>}
      >
        <span className="mono text-2xl font-semibold tracking-tight text-text">{fmtDay(run.runDate)}</span>
      </Tile>

      <Tile
        label={S.PASSING}
        sub={
          <div className="flex flex-col gap-1.5">
            <span>{S.OF_UNIVERSE.replace("{total}", String(run.universeSize))}</span>
            <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(share * 100, 1)}%` }} />
            </div>
          </div>
        }
      >
        <span className="mono text-2xl font-semibold tracking-tight text-accent">{run.passedCount}</span>
        <span className="mono text-md text-text-mute">/ {run.universeSize}</span>
        <span className="mono text-sm text-text-mute ml-auto">{(share * 100).toFixed(1)}%</span>
      </Tile>

      <Tile
        label={S.CURRENT_RUN}
        sub={<span className={isCurrent ? undefined : "text-loss"}>{isCurrent ? S.CAN_OPEN : S.CANNOT_OPEN}</span>}
      >
        <span
          className={cn(
            "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-md font-medium",
            isCurrent ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss",
          )}
        >
          <span className={cn("size-1.5 rounded-full", isCurrent ? "bg-profit" : "bg-loss")} />
          {isCurrent ? S.ACTIVE : S.MISSING}
        </span>
      </Tile>

      <Tile label={S.BENCHMARK} hint={S.BENCHMARK_HINT} sub={S.BENCHMARK_SUB}>
        <span className="mono text-2xl font-semibold tracking-tight text-text truncate">{run.benchmark}</span>
      </Tile>
    </div>
  )
}
