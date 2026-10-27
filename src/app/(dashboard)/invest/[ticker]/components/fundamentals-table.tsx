import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import type { FundamentalsRow } from "~/lib/calculations/invest-detail"
import { cn } from "~/utils/cn"
import { fmtMultiple, fmtPct, signColor } from "../../components/invest-format"

const D = INVEST.DETAIL
const H = D.HEADERS

function compact(n: number | null): string {
  if (n == null) return "—"
  const a = Math.abs(n)
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a.toLocaleString("en-US")
  return n < 0 ? `−${s}` : s
}

/** Variación debajo del valor: % interanual o puntos (pp) de diferencia. */
function Change({ value, points = false }: { value: number | null; points?: boolean }): ReactElement | null {
  if (value == null) return null
  const text = points
    ? `${value >= 0 ? "+" : "−"}${(Math.abs(value) * 100).toFixed(1)} pp`
    : fmtPct(value, { sign: true })
  return <div className={cn("mono text-xs", signColor(value))}>{text}</div>
}

export function FundamentalsTable({ rows, currency }: { rows: FundamentalsRow[]; currency: string | null }): ReactElement {
  const cell = "px-3 py-2.5 text-right align-top"
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            {[H.YEAR, H.REVENUE, H.GROSS, H.FCF, H.ROIC, H.ND_EBITDA].map((h, i) => (
              <th key={h} className="label-caps px-3 py-2.5 border-b border-border whitespace-nowrap" style={{ textAlign: i === 0 ? "left" : "right" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.fiscalYear} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5 mono text-sm font-semibold text-text align-top">{r.fiscalYear}</td>
              <td className={cell}>
                <div className="mono text-sm text-text">{compact(r.revenue)}</div>
                <Change value={r.revenueYoY} />
              </td>
              <td className={cell}>
                <div className="mono text-sm text-text">{fmtPct(r.grossMargin)}</div>
                <Change value={r.grossMarginDelta} points />
              </td>
              <td className={cell}>
                <div className={cn("mono text-sm", r.fcf != null && r.fcf < 0 ? "text-loss" : "text-text")}>{compact(r.fcf)}</div>
                <Change value={r.fcfYoY} />
              </td>
              <td className={cell}>
                <div className="mono text-sm text-text">{fmtPct(r.roic)}</div>
                <Change value={r.roicDelta} points />
              </td>
              <td className={cell}>
                <div className="mono text-sm text-text">{fmtMultiple(r.netDebtEbitda)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {currency && (
        <div className="px-3 py-2 text-xs text-text-mute">{D.CURRENCY_NOTE.replace("{currency}", currency)}</div>
      )}
    </div>
  )
}
