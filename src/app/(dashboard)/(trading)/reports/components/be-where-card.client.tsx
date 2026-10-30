"use client"

import { useState } from "react"
import type { ReactElement } from "react"
import type { BeGroupKey, BeGroupRow } from "~/lib/calculations/be-analysis"
import { REPORTS } from "~/constants/copies/reports"
import { formatPct } from "~/helpers/format"
import { cn } from "~/utils/cn"

const C = REPORTS.BE.WHERE
const DIMS: BeGroupKey[] = ["hour", "weekday", "instrument", "playbook", "direction"]
const MIN_TRADES = 5

function groupLabel(dim: BeGroupKey, row: BeGroupRow): string {
  if (dim === "playbook" && row.label == null) return C.NO_PLAYBOOK
  if (dim === "direction") return row.label === "short" ? C.SHORT : C.LONG
  return row.label ?? "—"
}

// Tasa de BE por hora, día, instrumento, playbook o dirección, contra la tasa
// global del rango. Los grupos con pocos trades se atenúan.
export function BeWhereCard({ groups, overall }: {
  groups:  Record<BeGroupKey, BeGroupRow[]>
  overall: number
}): ReactElement {
  const [dim, setDim] = useState<BeGroupKey>("hour")
  const rows = groups[dim]

  return (
    <div className="card p-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-border">
        <span className="label-caps">{C.TITLE}</span>
        <div className="flex flex-wrap gap-1 md:ml-auto">
          {DIMS.map(d => (
            <button
              key={d}
              onClick={() => setDim(d)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs border cursor-pointer",
                d === dim
                  ? "bg-surface-2 border-border-hi text-text font-semibold"
                  : "border-transparent text-text-mute hover:text-text",
              )}
            >
              {C.DIMS[d]}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-mute">
            <th className="label-caps text-left font-normal px-4 py-2">{C.COL_GROUP}</th>
            <th className="label-caps text-left font-normal px-2 py-2 w-1/2">
              {C.COL_RATE}
              <span className="normal-case tracking-normal ml-2">{C.OVERALL.replace("{rate}", formatPct(overall, 0))}</span>
            </th>
            <th className="label-caps text-right font-normal px-2 py-2">{C.COL_COUNT}</th>
            <th className="label-caps text-right font-normal px-4 py-2">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const above = r.rate > overall && r.be > 0
            const few   = r.trades < MIN_TRADES
            return (
              <tr key={r.key} className={cn("border-t border-border", few && "opacity-50")}>
                <td className="px-4 py-2 mono text-text whitespace-nowrap">{groupLabel(dim, r)}</td>
                <td className="px-2 py-2">
                  <div className="relative h-2.5 rounded-sm bg-surface-2">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm"
                      style={{ width: `${r.rate * 100}%`, background: above ? "var(--color-short)" : "var(--color-text-mute)" }}
                    />
                    <div
                      className="absolute -inset-y-1 w-px bg-text-dim"
                      style={{ left: `${overall * 100}%` }}
                    />
                  </div>
                </td>
                <td className="px-2 py-2 mono text-right text-text-dim">{r.be} / {r.trades}</td>
                <td className={cn("px-4 py-2 mono text-right font-semibold", above ? "text-short" : "text-text")}>
                  {formatPct(r.rate, 0)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-4 py-2.5 text-xs text-text-mute border-t border-border">
        {C.HINT.replace("{n}", String(MIN_TRADES))}
      </div>
    </div>
  )
}
