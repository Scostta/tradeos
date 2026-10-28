import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import type { LatestCheck } from "~/services/queries/invest"
import { cn } from "~/utils/cn"
import { fmtDay } from "../../components/invest-format"

const P = INVEST.POSITIONS

export function SignalBadge({ check }: { check: LatestCheck | null }): ReactElement {
  if (!check) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-mute whitespace-nowrap">{P.NO_CHECK}</span>
  }
  const sell = check.signal === "sell"
  return (
    <span
      title={sell ? P.SELL_HINT.replace("{date}", fmtDay(check.runDate)) : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
        sell ? "bg-loss/10 text-loss" : "bg-profit/10 text-profit",
      )}
    >
      <span className={cn("size-1.5 rounded-full", sell ? "bg-loss" : "bg-profit")} />
      {sell ? P.SIGNAL_SELL : P.SIGNAL_HOLD}
    </span>
  )
}
