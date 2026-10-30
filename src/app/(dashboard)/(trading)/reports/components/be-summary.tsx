import type { ReactElement } from "react"
import type { BeStats } from "~/lib/calculations/be-analysis"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency } from "~/helpers/format"

const C = REPORTS.BE

// Una línea de BE en R-Multiples; el análisis completo está en su pestaña.
export function BeSummary({ stats, onOpen }: { stats: BeStats; onOpen: () => void }): ReactElement | null {
  if (stats.total === 0) return null
  const reached = stats.reached.find(r => r.level === 1)?.count ?? 0

  return (
    <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span className="text-sm text-text-dim">
        {C.SUMMARY
          .replace("{total}", String(stats.total))
          .replace("{reached}", String(reached))
          .replace("{missed}", formatCurrency(stats.missedAt1R, { sign: false, decimals: 0 }))}
      </span>
      <button onClick={onOpen} className="btn-ghost ml-auto">
        {C.SUMMARY_LINK} →
      </button>
    </div>
  )
}
