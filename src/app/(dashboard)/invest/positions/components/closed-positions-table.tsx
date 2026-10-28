import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import { ClickableRow } from "../../components/clickable-row.client"
import { TriangleAlertIcon } from "~/lib/ui/icons/triangle-alert-icon"
import { cn } from "~/utils/cn"
import { PAPER_BADGE_CLS, fmtDay, fmtEur, fmtPrice, fmtShares, signColor } from "../../components/invest-format"
import type { ClosedRow } from "./positions-data"

const P = INVEST.POSITIONS
const H = P.HEADERS

const HEADERS = [
  { label: H.TICKER, align: "left"  },
  { label: H.OPENED, align: "left"  },
  { label: H.CLOSED, align: "left"  },
  { label: H.SHARES, align: "right" },
  { label: H.ENTRY,  align: "right" },
  { label: H.EXIT,   align: "right" },
  { label: H.GROSS,  align: "right" },
  { label: H.FEES,   align: "right" },
  { label: H.TAX,    align: "right" },
  { label: H.NET,    align: "right" },
  { label: H.REASON, align: "left"  },
] as const

const CELL = "px-3 py-2.5 mono text-sm text-right whitespace-nowrap"

export function ClosedPositionsTable({ rows }: { rows: ClosedRow[] }): ReactElement {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <span className="text-md font-semibold text-text">{P.CLOSED_TITLE}</span>
        <span className="mono text-xs px-1.5 py-0.5 rounded-sm bg-surface-2 text-text-dim">{rows.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              {HEADERS.map(h => (
                <th
                  key={h.label}
                  className="label-caps px-3 py-2.5 border-b border-border whitespace-nowrap"
                  style={{ textAlign: h.align }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length} className="py-12 text-text-mute text-sm text-center">{P.CLOSED_EMPTY}</td>
              </tr>
            ) : (
              rows.map(({ position: p, result: r, tax }) => {
                const manual = p.exitReason === "manual"
                const net = r && tax != null ? r.netPnlEur - tax : null
                return (
                  <ClickableRow key={p.id} href={APP_URLS.INVEST_POSITION(p.ticker)} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link href={APP_URLS.INVEST_POSITION(p.ticker)} className="mono text-sm font-semibold text-text hover:text-accent">
                        {p.ticker}
                      </Link>
                      {p.paper && <span className={`${PAPER_BADGE_CLS} ml-2`}>{INVEST.PERFORMANCE.PAPER_BADGE}</span>}
                    </td>
                    <td className="px-3 py-2.5 mono text-sm text-text-dim whitespace-nowrap">{fmtDay(p.openedAt)}</td>
                    <td className="px-3 py-2.5 mono text-sm text-text-dim whitespace-nowrap">{p.closedAt ? fmtDay(p.closedAt) : "—"}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtShares(p.shares)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtPrice(p.entryPrice, null)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtPrice(p.exitPrice, null)}</td>
                    <td className={`${CELL} ${signColor(r?.grossPnlEur ?? null)}`}>{fmtEur(r?.grossPnlEur ?? null, { sign: true })}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtEur(r?.feesEur ?? null, { decimals: 2 })}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtEur(tax, { decimals: 2 })}</td>
                    <td className={`${CELL} ${signColor(net)}`}>{fmtEur(net, { sign: true })}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap" title={p.exitNote ?? undefined}>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-sm",
                          manual ? "bg-short/10 text-short" : "bg-surface-2 text-text-dim",
                        )}
                      >
                        {manual && <TriangleAlertIcon />}
                        {p.exitReason ? P.REASONS[p.exitReason] : "—"}
                      </span>
                      {manual && <span className="ml-2 text-xs text-short" title={P.DEVIATION_HINT}>{P.DEVIATION}</span>}
                    </td>
                  </ClickableRow>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-border text-xs text-text-mute">{P.TAX_NOTE}</div>
    </div>
  )
}
