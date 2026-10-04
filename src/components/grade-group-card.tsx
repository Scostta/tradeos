import type { ReactElement } from "react"
import { COMMON } from "~/constants/copies/common"
import { formatCurrency, formatPct } from "~/helpers/format"
import { GradeBadge } from "~/components/grade-badge"
import type { GradeGroup } from "~/types/playbook"

const fmtR = (r: number): string => `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(2)}R`

/**
 * Results of one setup grade. Expectancy (R) leads: it is the metric that says
 * whether sizing by grade is justified, independent of position size.
 */
export function GradeGroupCard({ group }: { group: GradeGroup }): ReactElement {
  const hasR = group.rCoverage.withR > 0
  const rows = [
    { k: COMMON.GRADES.TRADES,   v: String(group.count) },
    { k: COMMON.GRADES.WIN_RATE, v: group.count ? formatPct(group.winRate) : "—" },
    { k: COMMON.GRADES.NET_PNL,  v: group.count ? formatCurrency(group.netPnl) : "—" },
  ]
  return (
    <div className="bg-surface p-4 flex flex-col gap-3">
      <div>
        {group.grade === null
          ? <span className="text-xs font-semibold text-text-mute">{COMMON.GRADES.UNGRADED}</span>
          : <GradeBadge grade={group.grade} />}
      </div>
      <div>
        <div className="label-caps mb-1">{COMMON.GRADES.EXPECTANCY_R}</div>
        <div
          className="mono text-lg font-semibold"
          style={{ color: !hasR ? "var(--color-text-mute)" : group.expectancyR >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
        >
          {hasR ? fmtR(group.expectancyR) : "—"}
        </div>
        {hasR && group.rCoverage.withR < group.rCoverage.total && (
          <div className="mono text-xxs text-text-mute">
            {group.rCoverage.withR}/{group.rCoverage.total} {COMMON.GRADES.WITH_R}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map(r => (
          <div key={r.k} className="flex justify-between text-sm">
            <span className="text-text-mute">{r.k}</span>
            <span className="mono text-text">{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
