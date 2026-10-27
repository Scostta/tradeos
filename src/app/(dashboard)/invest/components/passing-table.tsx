import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { APP_URLS } from "~/constants/app-urls"
import { ClickableRow } from "./clickable-row.client"
import { distanceToSma } from "~/lib/calculations/invest-run"
import type { ScreenResult } from "~/types/invest"
import { fmtMultiple, fmtPct, fmtPrice, signColor } from "./invest-format"
import { TickerLink } from "./ticker-link.client"
import { OpenPositionButton } from "./open-position-button.client"
import type { OpenCandidate } from "./open-position-modal.client"
import type { OpenBlocker } from "~/lib/calculations/invest-run"

const H = INVEST.SCREEN.HEADERS

const HEADERS = [
  { label: H.TICKER,    align: "left"  },
  { label: H.SECTOR,    align: "left"  },
  { label: H.PRICE,     align: "right" },
  { label: H.VS_SMA,    align: "right" },
  { label: H.MOMENTUM,  align: "right" },
  { label: H.RS,        align: "right" },
  { label: H.GROWTH,    align: "right" },
  { label: H.FCF,       align: "right" },
  { label: H.ROIC,      align: "right" },
  { label: H.ND_EBITDA, align: "right" },
  { label: "",          align: "right" },
] as const

const CELL = "px-3 py-2.5 mono text-sm text-right whitespace-nowrap"

export type OpenAction = { candidate: OpenCandidate; blockers: OpenBlocker[] }

type Props = {
  rows:    ScreenResult[]
  actions: Record<string, OpenAction>   // por ticker
}

export function PassingTable({ rows, actions }: Props): ReactElement {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <span className="text-md font-semibold text-text">{INVEST.SCREEN.TABLE_TITLE}</span>
        <span className="mono text-xs px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent">{rows.length}</span>
      </div>
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length} className="py-16 text-text-mute text-sm text-center">
                  {INVEST.SCREEN.TABLE_EMPTY}
                </td>
              </tr>
            ) : (
              rows.map(r => {
                const vsSma = distanceToSma(r.price, r.sma10m)
                return (
                  <ClickableRow key={r.id} href={APP_URLS.INVEST_TICKER(r.ticker)} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-3 py-2" style={{ maxWidth: 240 }}>
                      <TickerLink ticker={r.ticker} />
                      <div className="text-xs text-text-mute truncate">{r.name ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded-sm bg-surface-2 text-text-dim">
                        {r.sector ?? INVEST.SCREEN.NO_SECTOR}
                      </span>
                    </td>
                    <td className={`${CELL} text-text`}>{fmtPrice(r.price, r.currency)}</td>
                    <td className={`${CELL} ${signColor(vsSma)}`}>{fmtPct(vsSma, { sign: true })}</td>
                    <td className={`${CELL} ${signColor(r.momentum121)}`}>{fmtPct(r.momentum121, { sign: true })}</td>
                    <td className={`${CELL} ${signColor(r.relStrength6m)}`}>{fmtPct(r.relStrength6m, { sign: true })}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtPct(r.revenueGrowthYoy)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtPct(r.fcfMargin)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtPct(r.roic)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtMultiple(r.netDebtEbitda)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {actions[r.ticker] && (
                        <OpenPositionButton
                          candidate={actions[r.ticker].candidate}
                          blockers={actions[r.ticker].blockers}
                        />
                      )}
                    </td>
                  </ClickableRow>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
