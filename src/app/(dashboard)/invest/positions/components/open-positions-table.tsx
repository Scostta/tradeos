import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import { cn } from "~/utils/cn"
import { ClickableRow } from "../../components/clickable-row.client"
import { PAPER_BADGE_CLS, fmtDay, fmtEur, fmtPct, fmtPrice, fmtShares, signColor } from "../../components/invest-format"
import { ClosePositionButton } from "./close-position-button.client"
import type { OpenRow } from "./positions-data"
import { SignalBadge } from "./signal-badge"

const P = INVEST.POSITIONS
const H = P.HEADERS

const HEADERS = [
  { label: H.TICKER, align: "left"  },
  { label: H.SECTOR, align: "left"  },
  { label: H.OPENED, align: "left"  },
  { label: H.ENTRY,  align: "right" },
  { label: H.SHARES, align: "right" },
  { label: H.COST,   align: "right" },
  { label: H.LAST,   align: "right" },
  { label: H.PNL,    align: "right" },
  { label: H.SIGNAL, align: "left"  },
  { label: "",       align: "right" },
] as const

const CELL = "px-3 py-2.5 mono text-sm text-right whitespace-nowrap"

// §4.3: gráfico, tesis, falsadores y checks viven en /invest/positions/[id]; aquí solo números.
export function OpenPositionsTable({ rows }: { rows: OpenRow[] }): ReactElement {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <span className="text-md font-semibold text-text">{P.OPEN_TITLE}</span>
        <span className="mono text-xs px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-10 flex flex-col items-center gap-3 text-center">
          <span className="text-sm text-text-mute">{P.OPEN_EMPTY}</span>
          <Link href={APP_URLS.INVEST} className="btn-ghost">{P.GO_TO_SCREEN}</Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 960 }}>
            <thead>
              <tr>
                {HEADERS.map(h => (
                  <th
                    key={h.label || "action"}
                    className="label-caps px-3 py-2.5 border-b border-border whitespace-nowrap"
                    style={{ textAlign: h.align }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ position: p, valuation: v, check }) => {
                const sell = check?.signal === "sell"
                return (
                  <ClickableRow
                    key={p.id}
                    href={APP_URLS.INVEST_POSITION(p.id)}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors",
                      sell ? "bg-loss/5 hover:bg-loss/10" : "hover:bg-surface-2",
                    )}
                  >
                    <td className="px-3 py-2" style={{ maxWidth: 240 }}>
                      <div className="flex items-center gap-2">
                        <Link href={APP_URLS.INVEST_POSITION(p.id)} className="mono text-sm font-semibold text-text hover:text-accent">
                          {p.ticker}
                        </Link>
                        {p.paper && <span className={PAPER_BADGE_CLS}>{INVEST.PERFORMANCE.PAPER_BADGE}</span>}
                      </div>
                      <div className="text-xs text-text-mute truncate">{p.name ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded-sm bg-surface-2 text-text-dim">
                        {p.sector ?? INVEST.SCREEN.NO_SECTOR}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 mono text-sm text-text-dim whitespace-nowrap">{fmtDay(p.openedAt)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtPrice(p.entryPrice, p.currency)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtShares(p.shares)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtEur(v.costEur)}</td>
                    <td className={CELL}>
                      <span className="text-text">{fmtPrice(v.lastPrice, p.currency)}</span>
                      <div className="text-xs text-text-mute">{v.lastMonth ? P.LAST_PRICE_AT.replace("{date}", v.lastMonth) : P.NO_PRICE}</div>
                    </td>
                    <td className={CELL}>
                      <span className={cn("font-semibold", signColor(v.pnlEur))}>{fmtEur(v.pnlEur, { sign: true })}</span>
                      <div className={cn("text-xs", signColor(v.pnlPct))}>{fmtPct(v.pnlPct, { sign: true })}</div>
                    </td>
                    <td className="px-3 py-2.5"><SignalBadge check={check} /></td>
                    <td className="px-3 py-2.5 text-right">
                      <ClosePositionButton
                        position={{
                          id:         p.id,
                          ticker:     p.ticker,
                          currency:   p.currency,
                          openedAt:   p.openedAt,
                          falsifiers: p.falsifiers,
                          sellSignal: sell,
                          lastPrice:  v.lastPrice,
                        }}
                      />
                    </td>
                  </ClickableRow>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
