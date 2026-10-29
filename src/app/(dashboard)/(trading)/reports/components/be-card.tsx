"use client"

import type { ReactElement } from "react"
import Link from "next/link"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency, formatDateTime } from "~/helpers/format"
import { useTimezone } from "~/hooks/use-timezone"
import type { BeStats } from "~/lib/calculations/be-analysis"
import { cn } from "~/utils/cn"

const C = REPORTS.BE
const ROWS = 10

const fmtR = (r: number): string => `+${r.toFixed(2)}R`

// ¿Hasta dónde llegaron los break-even? MFE en R de cada BE y cuántos tocaron
// +0.5R / +1R / +2R antes de volver. Solo cifras: la conclusión es del trader.
export function BeCard({ stats }: { stats: BeStats }): ReactElement | null {
  const tz = useTimezone()
  if (stats.total === 0) return null

  return (
    <div className="card p-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 border-b border-border">
        <span className="label-caps">{C.TITLE}</span>
        <span className="mono text-xs text-text-mute ml-auto">
          {C.COVERAGE.replace("{measured}", String(stats.measured)).replace("{total}", String(stats.total))}
        </span>
      </div>

      {stats.measured === 0 ? (
        <div className="px-4 py-6 text-sm text-text-mute">{C.NOT_MEASURED}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border border-b border-border">
            {stats.reached.map(r => (
              <div key={r.level} className="bg-surface px-4 py-3.5 flex flex-col gap-1">
                <span className="label-caps">{C.REACHED.replace("{r}", String(r.level))}</span>
                <span className={cn("mono text-xl font-semibold", r.count > 0 && r.level >= 1 ? "text-short" : "text-text")}>
                  {r.count}<span className="text-sm text-text-mute font-normal"> / {stats.measured}</span>
                </span>
              </div>
            ))}
            <div className="bg-surface px-4 py-3.5 flex flex-col gap-1">
              <span className="label-caps">{C.AVG_MFE}</span>
              <span className="mono text-xl font-semibold text-text">{stats.avgMfeR != null ? fmtR(stats.avgMfeR) : "—"}</span>
            </div>
            <div className="bg-surface px-4 py-3.5 flex flex-col gap-1">
              <span className="label-caps">{C.MISSED}</span>
              <span className={cn("mono text-xl font-semibold", stats.missedAt1R > 0 ? "text-short" : "text-text")}>
                {formatCurrency(stats.missedAt1R, { sign: false, decimals: 0 })}
              </span>
            </div>
          </div>

          <div className="px-4 py-2.5 text-xs text-text-mute border-b border-border">{C.MISSED_HINT}</div>

          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-mute">
                <th className="label-caps text-left font-normal px-4 py-2">{C.COL_DATE}</th>
                <th className="label-caps text-left font-normal px-2 py-2">{C.COL_INSTRUMENT}</th>
                <th className="label-caps text-right font-normal px-2 py-2">{C.COL_MFE}</th>
                <th className="label-caps text-right font-normal px-2 py-2">{C.COL_MFE_R}</th>
                <th className="label-caps text-right font-normal px-4 py-2">{C.COL_NET}</th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.slice(0, ROWS).map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-4 py-2 mono text-text-dim whitespace-nowrap">
                    <Link href={`/trades/${r.id}`} className="hover:text-text">{formatDateTime(r.entryTime, tz)}</Link>
                  </td>
                  <td className="px-2 py-2 mono text-text">{r.instrument}</td>
                  <td className="px-2 py-2 mono text-right text-text-dim">{formatCurrency(r.mfe, { sign: false, decimals: 0 })}</td>
                  <td className={cn("px-2 py-2 mono text-right font-semibold", r.mfeR >= 1 ? "text-short" : "text-text")}>{fmtR(r.mfeR)}</td>
                  <td className="px-4 py-2 mono text-right text-text-dim">{formatCurrency(r.netPnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.rows.length > ROWS && (
            <div className="px-4 py-2 text-xs text-text-mute border-t border-border">
              {C.MORE.replace("{n}", String(stats.rows.length - ROWS))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
