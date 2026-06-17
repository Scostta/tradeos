"use client"

import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency, formatDateTime } from "~/helpers/format"
import { formatDuration } from "~/helpers/duration"
import { useTimezone } from "~/hooks/use-timezone"
import { TRADES } from "~/constants/copies/trades"
import type { Trade } from "~/types/trade"

function pnlColorVar(n: number): string {
  if (n > 0) return "var(--color-profit)"
  if (n < 0) return "var(--color-loss)"
  return "var(--color-text-dim)"
}

type Props = {
  trade:      Trade
  playbooks: { id: string; name: string }[]
}

export function TradesTableRow(props: Props): ReactElement {
  const { trade, playbooks } = props
  const router = useRouter()
  const tz = useTimezone()

  const playbookName = trade.playbookId
    ? (playbooks.find(s => s.id === trade.playbookId)?.name ?? "—")
    : "—"

  const pnlColor   = pnlColorVar(trade.netPnl)
  const grossColor = pnlColorVar(trade.pnl)
  const isLong     = trade.direction === "long"

  return (
    <tr
      className="border-b border-border transition-colors hover:bg-surface-2 cursor-pointer"
      onClick={() => router.push(`/trades/${trade.id}`)}
    >
      <td className="px-3 py-2.5 mono text-text-mute text-xs">
        {trade.tradeNumber !== null
          ? trade.tradeNumber.toString().padStart(4, "0")
          : "—"}
      </td>
      <td className="px-3 py-2.5 mono text-text-dim text-xs whitespace-nowrap">
        {formatDateTime(trade.entryTime, tz)}
      </td>
      <td className="px-3 py-2.5 font-semibold text-text mono text-xs">
        {trade.instrument}
      </td>
      <td className="px-3 py-2.5">
        <span
          style={{
            display:       "inline-flex",
            alignItems:    "center",
            padding:       "2px 6px",
            borderRadius:  4,
            fontSize:      10,
            fontWeight:    600,
            letterSpacing: "0.06em",
            background:    isLong ? "rgba(59,130,246,.15)" : "rgba(245,158,11,.15)",
            border:        `1px solid ${isLong ? "rgba(59,130,246,.35)" : "rgba(245,158,11,.35)"}`,
            color:         isLong ? "var(--color-long)" : "var(--color-short)",
          }}
        >
          {isLong ? TRADES.LIST.DIR_BADGE.LONG : TRADES.LIST.DIR_BADGE.SHORT}
        </span>
      </td>
      <td className="px-3 py-2.5 mono text-text text-xs text-right">
        {trade.contracts}
      </td>
      <td className="px-3 py-2.5 mono text-text-dim text-xs text-right">
        {trade.entryPrice.toFixed(2)}
      </td>
      <td className="px-3 py-2.5 mono text-text-dim text-xs text-right">
        {trade.exitPrice.toFixed(2)}
      </td>
      <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: grossColor }}>
        {formatCurrency(trade.pnl)}
      </td>
      <td className="px-3 py-2.5 mono text-text-dim text-xs text-right">
        {formatCurrency(trade.commission, { sign: false })}
      </td>
      <td className="px-3 py-2.5 mono font-semibold text-xs text-right" style={{ color: pnlColor }}>
        {formatCurrency(trade.netPnl)}
      </td>
      <td className="px-3 py-2.5 text-text-dim text-xs">
        {playbookName}
      </td>
      <td className="px-3 py-2.5 mono text-text-mute text-xs text-right">
        {formatDuration(trade.entryTime, trade.exitTime)}
      </td>
    </tr>
  )
}
