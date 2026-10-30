import type { ReactElement } from "react"
import type { TiltReport, TiltStats } from "~/lib/calculations/tilt"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency, formatPct } from "~/helpers/format"
import { cn } from "~/utils/cn"
import { TiltTable, TILT_MIN_TRADES } from "./tilt-table"

const C = REPORTS.TILT

const pnlClass = (n: number | null): string =>
  n == null || n === 0 ? "text-text" : n > 0 ? "text-profit" : "text-loss"

// ¿Cómo operas según lo que acaba de pasar? Por cuenta y día: trade anterior,
// racha, minutos desde la última salida, subir contratos y nº de trade.
export function TiltTab({ report }: { report: TiltReport }): ReactElement {
  const windowLabel = report.windows.length === 1
    ? C.WINDOW_MIN.replace("{n}", String(report.windows[0]))
    : C.WINDOW_ACCOUNT
  const afterLoss = report.previous.find(p => p.key === "loss")!.stats

  const head: { label: string; stats: TiltStats }[] = [
    { label: C.HEAD.ALL,        stats: report.all },
    { label: C.HEAD.AFTER_LOSS, stats: afterLoss },
    { label: C.HEAD.FAST.replace("{window}", windowLabel), stats: report.afterLoss.fast },
    { label: C.HEAD.SIZE_UP,    stats: report.afterLoss.sizeUp },
  ]

  return (
    <div className="flex flex-col gap-4.5">
      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          {head.map(h => (
            <div key={h.label} className={cn("bg-surface px-4 py-3.5 flex flex-col gap-1", h.stats.trades < TILT_MIN_TRADES && h.stats !== report.all && "opacity-60")}>
              <span className="label-caps">{h.label}</span>
              <span className={cn("mono text-xl font-semibold", pnlClass(h.stats.avgNet))}>
                {h.stats.avgNet != null ? formatCurrency(h.stats.avgNet) : "—"}
                <span className="text-sm text-text-mute font-normal"> {C.PER_TRADE}</span>
              </span>
              <span className="mono text-xs text-text-mute">
                {C.HEAD_SUB
                  .replace("{n}", String(h.stats.trades))
                  .replace("{win}", h.stats.winRate != null ? formatPct(h.stats.winRate, 0) : "—")}
              </span>
            </div>
          ))}
        </div>
      </div>

      <TiltTable
        title={C.PREVIOUS.TITLE}
        rows={report.previous.map(r => ({ ...r, label: C.PREVIOUS[r.key as keyof typeof C.PREVIOUS] }))}
      />

      <TiltTable
        title={C.AFTER_LOSS_TITLE}
        rows={[
          { key: "fast",     label: C.FAST.replace("{window}", windowLabel), stats: report.afterLoss.fast },
          { key: "slow",     label: C.SLOW.replace("{window}", windowLabel), stats: report.afterLoss.slow },
          { key: "sizeUp",   label: C.SIZE_UP,   stats: report.afterLoss.sizeUp },
          { key: "sameSize", label: C.SAME_SIZE, stats: report.afterLoss.sameSize },
        ]}
      />

      <GapCard gap={report.gap} />

      <TiltTable
        title={C.STREAK_TITLE}
        rows={report.streak.map(r => ({ ...r, label: C.STREAK.replace("{n}", r.key) }))}
      />

      <TiltTable
        title={C.NUMBER_TITLE}
        rows={report.tradeNumber.map(r => ({ ...r, label: C.NUMBER.replace("{n}", r.key) }))}
      />

      <p className="text-xs text-text-mute">{C.FOOTNOTE.replace("{n}", String(TILT_MIN_TRADES))}</p>
    </div>
  )
}

// Minutos desde la última salida: tras una pérdida frente al resto.
function GapCard({ gap }: { gap: TiltReport["gap"] }): ReactElement {
  const cell = (s: TiltStats): ReactElement => (
    <td className={cn("px-2 py-2 mono text-right", s.trades < TILT_MIN_TRADES && "opacity-50")}>
      <span className={cn("font-semibold", s.avgNet == null || s.avgNet === 0 ? "text-text-dim" : s.avgNet > 0 ? "text-profit" : "text-loss")}>
        {s.avgNet != null ? formatCurrency(s.avgNet) : "—"}
      </span>
      <span className="text-text-mute"> · {s.trades}</span>
    </td>
  )

  return (
    <div className="card p-0 overflow-x-auto">
      <div className="px-4 py-3 border-b border-border">
        <span className="label-caps">{C.GAP.TITLE}</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-mute">
            <th className="label-caps text-left font-normal px-4 py-2">{C.GAP.COL_GAP}</th>
            <th className="label-caps text-right font-normal px-2 py-2">{C.GAP.COL_AFTER_LOSS}</th>
            <th className="label-caps text-right font-normal px-4 py-2">{C.GAP.COL_OTHER}</th>
          </tr>
        </thead>
        <tbody>
          {gap.map(g => (
            <tr key={g.key} className="border-t border-border">
              <td className="px-4 py-2 mono text-text whitespace-nowrap">{C.GAP.BUCKETS[g.key]}</td>
              {cell(g.afterLoss)}
              {cell(g.other)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2.5 text-xs text-text-mute border-t border-border">{C.GAP.HINT}</div>
    </div>
  )
}
