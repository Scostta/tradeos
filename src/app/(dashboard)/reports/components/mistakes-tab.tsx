import type { ReactElement } from "react"
import type { MistakeRow } from "~/types/reports"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency, formatPct } from "~/helpers/format"
import { MiniBars } from "~/components/charts/mini-bars.client"

export function MistakesTab({ mistakes }: { mistakes: MistakeRow[] }): ReactElement {
  if (mistakes.length === 0) {
    return (
      <div className="card p-8 max-w-lg mx-auto text-center text-sm text-text-mute">
        {REPORTS.MISTAKES.EMPTY}
      </div>
    )
  }

  const bars = mistakes.map(m => ({ label: m.label, v: m.netPnl }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="card p-4">
        <div className="label-caps mb-3">{REPORTS.MISTAKES.CHART_LABEL}</div>
        <MiniBars data={bars} height={240} mode="signed" />
      </div>

      <div className="card" style={{ padding: 16 }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-mute">
              <th className="text-left  font-normal label-caps pb-2">{REPORTS.MISTAKES.TABLE.MISTAKE}</th>
              <th className="text-right font-normal label-caps pb-2">{REPORTS.MISTAKES.TABLE.TRADES}</th>
              <th className="text-right font-normal label-caps pb-2">{REPORTS.MISTAKES.TABLE.WIN_RATE}</th>
              <th className="text-right font-normal label-caps pb-2">{REPORTS.MISTAKES.TABLE.AVG_PNL}</th>
              <th className="text-right font-normal label-caps pb-2">{REPORTS.MISTAKES.TABLE.NET_PNL}</th>
            </tr>
          </thead>
          <tbody>
            {mistakes.map(m => (
              <tr key={m.label} className="border-t border-border">
                <td className="py-2 text-text">{m.label}</td>
                <td className="py-2 text-right mono text-text-dim">{m.trades}</td>
                <td className="py-2 text-right mono text-text-dim">{formatPct(m.winRate)}</td>
                <td className="py-2 text-right mono" style={{ color: m.avgPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>
                  {formatCurrency(m.avgPnl)}
                </td>
                <td className="py-2 text-right mono font-semibold" style={{ color: m.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>
                  {formatCurrency(m.netPnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
