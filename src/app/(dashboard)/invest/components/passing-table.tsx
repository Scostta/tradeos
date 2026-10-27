import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import { distanceToSma } from "~/lib/calculations/invest-run"
import type { ScreenResult } from "~/types/invest"
import { fmtMultiple, fmtPct, fmtPrice, signColor } from "./invest-format"

const H = INVEST.SCREEN.HEADERS

const HEADERS = [
  { label: H.TICKER,    align: "left"  },
  { label: H.NAME,      align: "left"  },
  { label: H.SECTOR,    align: "left"  },
  { label: H.PRICE,     align: "right" },
  { label: H.VS_SMA,    align: "right" },
  { label: H.MOMENTUM,  align: "right" },
  { label: H.RS,        align: "right" },
  { label: H.GROWTH,    align: "right" },
  { label: H.FCF,       align: "right" },
  { label: H.ROIC,      align: "right" },
  { label: H.ND_EBITDA, align: "right" },
] as const

const CELL = "px-3 py-2.5 mono text-sm text-right whitespace-nowrap"

export function PassingTable({ rows }: { rows: ScreenResult[] }): ReactElement {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="label-caps">{INVEST.SCREEN.TABLE_TITLE}</span>
        <span className="mono text-xs text-text-mute">{rows.length}</span>
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
                <td colSpan={HEADERS.length} className="py-16 text-text-mute text-sm text-center">
                  {INVEST.SCREEN.TABLE_EMPTY}
                </td>
              </tr>
            ) : (
              rows.map(r => {
                const vsSma = distanceToSma(r.price, r.sma10m)
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`${APP_URLS.INVEST}?tab=screen&q=${encodeURIComponent(r.ticker)}`}
                        className="mono text-sm font-semibold text-text hover:text-accent"
                      >
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-text-dim truncate" style={{ maxWidth: 220 }}>
                      {r.name ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-text-mute whitespace-nowrap">
                      {r.sector ?? INVEST.SCREEN.NO_SECTOR}
                    </td>
                    <td className={`${CELL} text-text`}>{fmtPrice(r.price, r.currency)}</td>
                    <td className={`${CELL} ${signColor(vsSma)}`}>{fmtPct(vsSma, { sign: true })}</td>
                    <td className={`${CELL} ${signColor(r.momentum121)}`}>{fmtPct(r.momentum121, { sign: true })}</td>
                    <td className={`${CELL} ${signColor(r.relStrength6m)}`}>{fmtPct(r.relStrength6m, { sign: true })}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtPct(r.revenueGrowthYoy)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtPct(r.fcfMargin)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtPct(r.roic)}</td>
                    <td className={`${CELL} text-text-dim`}>{fmtMultiple(r.netDebtEbitda)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
