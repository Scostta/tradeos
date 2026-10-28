import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import type { LatestCheck } from "~/services/queries/invest"
import { fmtDay, fmtPrice } from "../../../components/invest-format"
import { SignalBadge } from "../../components/signal-badge"

const D = INVEST.POSITION
const H = D.CHECKS_HEADERS
const CELL = "px-4 py-2.5 mono text-sm text-right whitespace-nowrap"

// Checks hold/sell que el job guarda tras cada cierre mensual (§2.6, §1.4).
export function ChecksTable({ checks, currency }: { checks: LatestCheck[]; currency: string | null }): ReactElement {
  if (checks.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-text-mute">{D.CHECKS_EMPTY}</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="label-caps px-4 py-2.5 border-b border-border text-left">{H.RUN}</th>
            <th className="label-caps px-4 py-2.5 border-b border-border text-right">{H.CLOSE}</th>
            <th className="label-caps px-4 py-2.5 border-b border-border text-right">{H.SMA}</th>
            <th className="label-caps px-4 py-2.5 border-b border-border text-left">{H.SIGNAL}</th>
          </tr>
        </thead>
        <tbody>
          {checks.map(c => (
            <tr key={c.runId} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 mono text-sm text-text-dim whitespace-nowrap">{fmtDay(c.runDate)}</td>
              <td className={`${CELL} text-text`}>{fmtPrice(c.price, currency)}</td>
              <td className={`${CELL} text-text-dim`}>{fmtPrice(c.sma10m, currency)}</td>
              <td className="px-4 py-2.5"><SignalBadge check={c} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
