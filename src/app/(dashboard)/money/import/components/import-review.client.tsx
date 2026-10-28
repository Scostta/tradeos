"use client"

import { useState } from "react"
import type { ReactElement, ReactNode } from "react"
import { MONEY } from "~/constants/copies/money"
import type { FinanceCategory, ImportPreview, ImportPreviewRow } from "~/types/finance"
import { cn } from "~/utils/cn"
import { displayName, fmtDay, fmtEur } from "../../components/money-format"
import { CategoryPill } from "../../components/category-pill"

const I = MONEY.IMPORT

function Metric({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: string }): ReactElement {
  return (
    <div className="card flex flex-col gap-2 px-4 py-3.5 min-w-0">
      <span className="label-caps">{label}</span>
      <span className={cn("mono text-3xl font-semibold tracking-tight leading-none", tone ?? "text-text")}>{value}</span>
      <span className="text-xs text-text-mute mt-auto">{sub}</span>
    </div>
  )
}

function range(rows: ImportPreviewRow[]): string {
  if (rows.length === 0) return "—"
  const dates = rows.map(r => r.bookedAt).sort()
  const [from, to] = [dates[0]!, dates[dates.length - 1]!]
  return from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`
}

function Row({ row, category }: { row: ImportPreviewRow; category: FinanceCategory | null }): ReactNode {
  const dup = row.status === "duplicate"
  return (
    <tr className={cn("border-b border-border last:border-0", dup ? "text-text-mute" : "hover:bg-surface-2")}>
      <td className="px-3 py-2 mono text-sm whitespace-nowrap text-text-dim">{fmtDay(row.bookedAt)}</td>
      <td className="px-3 py-2 min-w-0">
        <div className={cn("text-sm font-medium truncate", dup ? "text-text-mute" : "text-text")}>{displayName(row.counterparty)}</div>
        <div className="mono text-xs text-text-mute truncate">{row.conceptRaw}</div>
      </td>
      <td className={cn("px-3 py-2 mono text-sm text-right whitespace-nowrap", !dup && row.amount > 0 && "text-profit")}>
        {fmtEur(row.amount, { sign: true })}
      </td>
      <td className="px-3 py-2 mono text-sm text-right whitespace-nowrap text-text-mute">{fmtEur(row.balanceAfter)}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <CategoryPill category={category} muted={dup} />
        {row.byRule && <span className="mono text-xs text-text-mute ml-1.5">{I.RULE_TAG}</span>}
      </td>
      <td className="px-3 py-2">
        <span className={cn(
          "mono text-xs font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-sm",
          dup ? "bg-surface-2 text-text-mute" : "bg-profit/10 text-profit",
        )}>
          {dup ? I.STATUS_DUP : I.STATUS_NEW}
        </span>
      </td>
    </tr>
  )
}

// §3.2.3 (artboard 06): recuentos, tabla con la categoría que pondrá cada
// regla y el estado Nuevo/Duplicado, y los duplicados plegados.
export function ImportReview({ preview, categories, errorCount }: {
  preview:    ImportPreview
  categories: FinanceCategory[]
  errorCount: number
}): ReactElement {
  const [showDups, setShowDups] = useState(false)
  const byId = new Map(categories.map(c => [c.id, c]))
  const fresh = preview.rows.filter(r => r.status === "new")
  const dups = preview.rows.filter(r => r.status === "duplicate")

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Metric label={I.METRIC_READ} value={preview.rows.length} sub={range(preview.rows)} />
        <Metric label={I.METRIC_NEW} value={preview.newCount} tone="text-profit" sub={`${range(fresh)} · ${I.METRIC_NEW_SUB}`} />
        <Metric label={I.METRIC_DUP} value={preview.duplicates} tone="text-text-mute" sub={I.METRIC_DUP_SUB} />
        <Metric label={I.METRIC_NORULE} value={preview.noRule} tone="text-short" sub={I.METRIC_NORULE_SUB} />
      </div>

      {errorCount > 0 && (
        <div className="card px-4 py-2.5 text-sm text-short">{I.ROW_ERRORS.replace("{n}", String(errorCount))}</div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th className="label-caps px-3 py-2.5 border-b border-border text-left" style={{ width: 80 }}>{I.HEAD_DATE}</th>
              <th className="label-caps px-3 py-2.5 border-b border-border text-left">{I.HEAD_CONCEPT}</th>
              <th className="label-caps px-3 py-2.5 border-b border-border text-right" style={{ width: 110 }}>{I.HEAD_AMOUNT}</th>
              <th className="label-caps px-3 py-2.5 border-b border-border text-right" style={{ width: 110 }}>{I.HEAD_BALANCE}</th>
              <th className="label-caps px-3 py-2.5 border-b border-border text-left" style={{ width: 190 }}>{I.HEAD_CATEGORY}</th>
              <th className="label-caps px-3 py-2.5 border-b border-border text-left" style={{ width: 80 }}>{I.HEAD_STATUS}</th>
            </tr>
          </thead>
          <tbody>
            {fresh.map(r => <Row key={r.importKey} row={r} category={r.categoryId ? byId.get(r.categoryId) ?? null : null} />)}
            {showDups && dups.map(r => <Row key={r.importKey} row={r} category={r.categoryId ? byId.get(r.categoryId) ?? null : null} />)}
            {dups.length > 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-2.5 text-center text-sm text-text-mute">
                  {!showDups && <>{I.DUPS_HIDDEN.replace("{n}", String(dups.length))} · </>}
                  <button type="button" onClick={() => setShowDups(s => !s)} className="underline hover:text-text cursor-pointer">
                    {showDups ? I.HIDE : I.SHOW}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
