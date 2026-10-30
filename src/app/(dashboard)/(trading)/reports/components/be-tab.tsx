import type { ReactElement } from "react"
import type { BeReport } from "~/lib/calculations/be-analysis"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency, formatPct } from "~/helpers/format"
import { cn } from "~/utils/cn"
import { BeCard } from "./be-card"
import { BeWhereCard } from "./be-where-card.client"
import { BeMaeCard } from "./be-mae-card"
import { BeEvolutionCard } from "./be-evolution-card"
import { BeSourceCard } from "./be-source-card"

const C = REPORTS.BE

// Pestaña Break-even: cuántos, dónde salen, hasta dónde fueron a favor y en
// contra, cómo evolucionan y de dónde sale la etiqueta. Solo cifras.
export function BeTab({ report }: { report: BeReport }): ReactElement {
  const total = report.stats.total
  const head = [
    { label: C.HEAD.TRADES,     value: `${total}`, sub: ` / ${report.trades}` },
    { label: C.HEAD.RATE,       value: formatPct(report.rate) },
    { label: C.HEAD.NET,        value: formatCurrency(report.netPnl), tone: report.netPnl < 0 ? "text-loss" : report.netPnl > 0 ? "text-profit" : "text-text" },
    { label: C.HEAD.COMMISSION, value: formatCurrency(report.commission, { sign: false }) },
  ]

  return (
    <div className="flex flex-col gap-4.5">
      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          {head.map(h => (
            <div key={h.label} className="bg-surface px-4 py-3.5 flex flex-col gap-1">
              <span className="label-caps">{h.label}</span>
              <span className={cn("mono text-xl font-semibold", h.tone ?? "text-text")}>
                {h.value}
                {h.sub && <span className="text-sm text-text-mute font-normal">{h.sub}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div className="card px-4 py-6 text-sm text-text-mute">{C.NONE}</div>
      ) : (
        <>
          <BeWhereCard groups={report.groups} overall={report.rate} />
          <BeCard stats={report.stats} />
          <BeMaeCard mae={report.mae} total={total} />
          <BeEvolutionCard evolution={report.evolution} />
        </>
      )}

      <BeSourceCard source={report.source} />
    </div>
  )
}
