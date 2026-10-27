import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import type { PriceIndex } from "~/lib/calculations/invest-fx"
import { closedPositionResult, valueOpenPosition } from "~/lib/calculations/invest-positions"
import type { InvestPositionWithMeta } from "~/types/invest"
import { fmtDay, fmtEur, signColor } from "../../components/invest-format"

const P = INVEST.PERFORMANCE

// §1.6: en modo real, las posiciones de papel quedan fuera de la curva y se
// listan aquí, plegadas, con su P&L (latente si siguen abiertas).
export function PaperPositionsBlock({ positions, index }: {
  positions: InvestPositionWithMeta[]
  index:     PriceIndex
}): ReactElement {
  return (
    <details className="card p-0 overflow-hidden group">
      <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none select-none">
        <span className="text-text-mute transition-transform group-open:rotate-90">›</span>
        <span className="text-md font-semibold text-text">{P.PAPER_BLOCK}</span>
        <span className="mono text-xs px-1.5 py-0.5 rounded-sm bg-short/10 text-short">{positions.length}</span>
      </summary>
      <div className="border-t border-border">
        <p className="px-4 py-2.5 text-sm text-text-mute">{P.PAPER_BLOCK_HINT}</p>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {[P.PAPER_HEADERS.TICKER, P.PAPER_HEADERS.OPENED, P.PAPER_HEADERS.STATUS, P.PAPER_HEADERS.PNL].map((h, i) => (
                <th key={h} className="label-caps px-4 py-2 border-y border-border" style={{ textAlign: i === 3 ? "right" : "left" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(p => {
              const pnl = p.closedAt
                ? (closedPositionResult(p, index)?.netPnlEur ?? null)
                : valueOpenPosition(p, index).pnlEur
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 mono text-sm font-semibold text-text">{p.ticker}</td>
                  <td className="px-4 py-2 mono text-sm text-text-dim">{fmtDay(p.openedAt)}</td>
                  <td className="px-4 py-2 text-sm text-text-dim">
                    {p.closedAt ? P.PAPER_CLOSED.replace("{date}", fmtDay(p.closedAt)) : P.PAPER_OPEN}
                  </td>
                  <td className={`px-4 py-2 mono text-sm text-right ${signColor(pnl)}`}>{fmtEur(pnl, { sign: true })}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
