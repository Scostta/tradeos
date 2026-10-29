import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { HORIZON_MONTHS } from "~/types/invest"
import type { LatestCheck } from "~/services/queries/invest"
import { cn } from "~/utils/cn"

const D = INVEST.POSITION

function monthIndex(from: string, to: string): number {
  return (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7))
}

// Los 36 meses desde la apertura: un cuadro por cierre mensual con la señal
// del check (hold / sell) y el próximo cierre marcado.
export function ChecksStrip({ openedAt, checks, nextClose }: {
  openedAt:  string
  checks:    LatestCheck[]
  nextClose: string
}): ReactElement {
  const bySlot = new Map(checks.map(c => [monthIndex(openedAt, c.runDate), c.signal]))
  const next = monthIndex(openedAt, nextClose)
  const done = Math.max(0, Math.min(HORIZON_MONTHS, next))

  return (
    <div className="card px-4 py-3.5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="label-caps">{D.STRIP_TITLE.replace("{n}", String(done + 1)).replace("{total}", String(HORIZON_MONTHS))}</span>
        <span className="ml-auto inline-flex gap-3 text-xs text-text-mute">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent" />{D.STRIP_HOLD}</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-loss" />{D.STRIP_SELL}</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-accent" />{D.STRIP_NEXT}</span>
        </span>
      </div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${HORIZON_MONTHS}, minmax(0, 1fr))` }} role="img" aria-label={D.STRIP_ARIA.replace("{n}", String(checks.length))}>
        {Array.from({ length: HORIZON_MONTHS }, (_, i) => {
          const signal = bySlot.get(i)
          return (
            <span
              key={i}
              className={cn(
                "h-5.5 rounded-sm",
                signal === "sell" ? "bg-loss" : signal === "hold" ? "bg-accent" : i === next ? "border border-accent bg-accent/10" : "bg-surface-2",
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
