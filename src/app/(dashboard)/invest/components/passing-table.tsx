import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { APP_URLS } from "~/constants/app-urls"
import { ClickableRow } from "./clickable-row.client"
import { distanceToSma } from "~/lib/calculations/invest-run"
import type { ScreenResult } from "~/types/invest"
import { fmtMultiple, fmtPct, fmtPrice } from "./invest-format"
import { TickerLink } from "./ticker-link.client"
import { OpenPositionButton } from "./open-position-button.client"
import { heatStyle } from "./heat"
import type { OpenAction } from "./open-action"

const H = INVEST.SCREEN.HEADERS

const HEADERS = [
  { label: H.TICKER,    align: "left"  },
  { label: H.SECTOR,    align: "left"  },
  { label: H.PRICE,     align: "right" },
  { label: H.VS_SMA,    align: "right" },
  { label: H.MOMENTUM,  align: "right" },
  { label: H.RS,        align: "right" },
  { label: H.GROWTH,    align: "right" },
  { label: H.GM_DELTA,  align: "right" },
  { label: H.FCF,       align: "right" },
  { label: H.ROIC,      align: "right" },
  { label: H.ND_EBITDA, align: "right" },
  { label: "",          align: "right" },
] as const

const CELL = "px-3 py-2.5 mono text-sm text-right whitespace-nowrap"

type Props = {
  rows:       ScreenResult[]
  actions:    Record<string, OpenAction>   // por ticker
  aiTickers?: string[]                     // destacados por la IA (§4.8): marca "AI"
}

// Mapa de calor (§4.2): cuanto más fuerte la cifra, más intenso el fondo; el
// precio muy estirado sobre la SMA 10 (> 30 %) va en ámbar.
export function PassingTable({ rows, actions, aiTickers = [] }: Props): ReactElement {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <span className="text-md font-semibold text-text">{INVEST.SCREEN.TABLE_TITLE}</span>
        <span className="mono text-xs px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent">{rows.length}</span>
        <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 text-xs text-text-mute">
          {INVEST.SCREEN.HEAT_WEAKER}
          <span className="w-3.5 h-2.5 rounded-sm" style={heatStyle(0.1)} />
          <span className="w-3.5 h-2.5 rounded-sm" style={heatStyle(0.5)} />
          <span className="w-3.5 h-2.5 rounded-sm" style={heatStyle(1)} />
          {INVEST.SCREEN.HEAT_STRONGER}
          <span className="w-3.5 h-2.5 rounded-sm ml-2" style={heatStyle(0.8, true)} />
          {INVEST.SCREEN.HEAT_STRETCHED}
        </span>
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
                const gmDelta = r.grossMargin != null && r.grossMarginPrev != null ? (r.grossMargin - r.grossMarginPrev) * 100 : null
                return (
                  <ClickableRow key={r.id} href={APP_URLS.INVEST_TICKER(r.ticker)} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-3 py-2" style={{ maxWidth: 240 }}>
                      <span className="inline-flex items-center gap-1.5">
                        <TickerLink ticker={r.ticker} />
                        {aiTickers.includes(r.ticker) && <span className="mono text-xs font-semibold px-1 rounded-sm bg-accent text-bg">AI</span>}
                      </span>
                      <div className="text-xs text-text-mute truncate">{r.name ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded-sm bg-surface-2 text-text-dim">
                        {r.sector ?? INVEST.SCREEN.NO_SECTOR}
                      </span>
                    </td>
                    <td className={`${CELL} text-text`}>{fmtPrice(r.price, r.currency)}</td>
                    <td className={`${CELL} ${((vsSma) ?? 0) < 0 ? "text-loss" : "text-text"}`} style={heatStyle(vsSma == null ? null : vsSma / 0.6, (vsSma ?? 0) > 0.3)}>{fmtPct(vsSma, { sign: true })}</td>
                    <td className={`${CELL} ${((r.momentum121) ?? 0) < 0 ? "text-loss" : "text-text"}`} style={heatStyle(r.momentum121 == null ? null : r.momentum121 / 1.2)}>{fmtPct(r.momentum121, { sign: true })}</td>
                    <td className={`${CELL} ${((r.relStrength6m) ?? 0) < 0 ? "text-loss" : "text-text"}`} style={heatStyle(r.relStrength6m == null ? null : r.relStrength6m / 0.6)}>{fmtPct(r.relStrength6m, { sign: true })}</td>
                    <td className={`${CELL} text-text`} style={heatStyle(r.revenueGrowthYoy == null ? null : r.revenueGrowthYoy / 0.6)}>{fmtPct(r.revenueGrowthYoy)}</td>
                    <td className={`${CELL} text-text`} style={heatStyle(gmDelta == null ? null : gmDelta / 20)}>{gmDelta == null ? "—" : `${gmDelta >= 0 ? "+" : ""}${gmDelta.toFixed(1)}`}</td>
                    <td className={`${CELL} text-text`} style={heatStyle(r.fcfMargin == null ? null : r.fcfMargin / 0.45)}>{fmtPct(r.fcfMargin)}</td>
                    <td className={`${CELL} text-text`} style={heatStyle(r.roic == null ? null : r.roic / 0.5)}>{fmtPct(r.roic)}</td>
                    <td className={`${CELL} text-text`} style={heatStyle(r.netDebtEbitda == null ? null : (2 - r.netDebtEbitda) / 3)}>{fmtMultiple(r.netDebtEbitda)}</td>
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
