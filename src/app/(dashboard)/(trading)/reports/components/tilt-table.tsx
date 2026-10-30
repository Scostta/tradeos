import type { ReactElement } from "react"
import type { TiltStats } from "~/lib/calculations/tilt"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency, formatPct } from "~/helpers/format"
import { cn } from "~/utils/cn"

const C = REPORTS.TILT
export const TILT_MIN_TRADES = 5

const pnlClass = (n: number | null): string =>
  n == null || n === 0 ? "text-text-dim" : n > 0 ? "text-profit" : "text-loss"

const fmtR = (r: number): string => `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(2)}R`

// Tabla de cifras por grupo (trades, win %, neto medio, R medio, neto). Los
// grupos con pocos trades se atenúan.
export function TiltTable({ title, rows }: {
  title: string
  rows:  { key: string; label: string; stats: TiltStats }[]
}): ReactElement {
  return (
    <div className="card p-0 overflow-x-auto">
      <div className="px-4 py-3 border-b border-border">
        <span className="label-caps">{title}</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-mute">
            <th className="label-caps text-left font-normal px-4 py-2">{C.COL_GROUP}</th>
            <th className="label-caps text-right font-normal px-2 py-2">{C.COL_TRADES}</th>
            <th className="label-caps text-right font-normal px-2 py-2">{C.COL_WIN}</th>
            <th className="label-caps text-right font-normal px-2 py-2">{C.COL_AVG}</th>
            <th className="label-caps text-right font-normal px-2 py-2">{C.COL_AVG_R}</th>
            <th className="label-caps text-right font-normal px-4 py-2">{C.COL_NET}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, stats: s }) => (
            <tr key={key} className={cn("border-t border-border", s.trades < TILT_MIN_TRADES && "opacity-50")}>
              <td className="px-4 py-2 text-text whitespace-nowrap">{label}</td>
              <td className="px-2 py-2 mono text-right text-text-dim">{s.trades}</td>
              <td className="px-2 py-2 mono text-right text-text">{s.winRate != null ? formatPct(s.winRate, 0) : "—"}</td>
              <td className={cn("px-2 py-2 mono text-right font-semibold", pnlClass(s.avgNet))}>
                {s.avgNet != null ? formatCurrency(s.avgNet) : "—"}
              </td>
              <td className={cn("px-2 py-2 mono text-right", pnlClass(s.avgR))}>{s.avgR != null ? fmtR(s.avgR) : "—"}</td>
              <td className={cn("px-4 py-2 mono text-right", pnlClass(s.netPnl))}>{s.trades ? formatCurrency(s.netPnl) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
