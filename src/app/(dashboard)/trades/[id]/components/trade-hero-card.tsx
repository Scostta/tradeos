"use client"

import type { ReactElement } from "react"
import { formatCurrency } from "~/helpers/format"
import { formatDuration } from "~/helpers/duration"
import { useStopPrice } from "./stop-price-context.client"
import type { Trade } from "~/types/trade"
import type { Account } from "~/types/account"
import type { Strategy } from "~/types/strategy"

const POINT_VALUES: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5 }

type Props = {
  trade:    Trade
  account:  Account | null
  strategy: Strategy | null
}

export function TradeHeroCard({ trade, account, strategy }: Props): ReactElement {
  const { stopPrice } = useStopPrice()

  const isLong   = trade.direction === "long"
  const isProfit = trade.netPnl >= 0
  const holdTime = formatDuration(trade.entryTime, trade.exitTime)
  const move     = ((trade.exitPrice - trade.entryPrice) * (isLong ? 1 : -1)).toFixed(2)

  // R:R — prefer real stop price, fall back to MAE
  const rr = (() => {
    const dir = isLong ? 1 : -1
    if (stopPrice !== null) {
      const riskPts   = (trade.entryPrice - stopPrice) * dir
      const pv        = (POINT_VALUES[trade.instrument.replace(/\s.*/, "").toUpperCase()] ?? 1) * trade.contracts
      const riskDolls = riskPts * pv
      if (riskDolls <= 0) return "—"
      return `1 : ${(Math.abs(trade.netPnl) / riskDolls).toFixed(2)}`
    }
    if (trade.mae && trade.mae !== 0) {
      return `1 : ${Math.abs(trade.netPnl / trade.mae).toFixed(2)}`
    }
    return "—"
  })()

  const specCells: Array<{ label: string; value: string; colorClass?: string }> = [
    { label: "ENTRY PRICE", value: trade.entryPrice.toFixed(2) },
    { label: "EXIT PRICE",  value: trade.exitPrice.toFixed(2) },
    { label: "MOVE",        value: `${move} pts` },
    { label: "RISK:REWARD", value: rr },
    {
      label:      "GROSS P&L",
      value:      formatCurrency(trade.pnl, { sign: false }),
      colorClass: trade.pnl >= 0 ? "text-profit" : "text-loss",
    },
    {
      label:      "COMMISSION",
      value:      `−$${trade.commission.toFixed(2)}`,
      colorClass: "text-text-dim",
    },
    {
      label:      "MAE",
      value:      trade.mae !== null ? formatCurrency(trade.mae, { sign: false }) : "—",
      colorClass: "text-loss",
    },
    {
      label:      "MFE",
      value:      trade.mfe !== null ? formatCurrency(trade.mfe, { sign: false }) : "—",
      colorClass: "text-profit",
    },
    { label: "HOLD TIME", value: holdTime },
    { label: "STRATEGY",  value: strategy?.name ?? "—" },
    { label: "SESSION",   value: trade.session ?? "—" },
    { label: "ACCOUNT",   value: account ? account.name : "—" },
  ]

  return (
    <div className="card p-5">
      {/* Hero row */}
      <div className="flex items-start gap-3 mb-5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="mono text-2xl font-semibold tracking-tight text-text">
            {trade.instrument}
          </span>
          <span
            className="mono text-xs font-semibold px-1.5 py-0.5 rounded-xs tracking-wider"
            style={{
              background: isLong ? "rgba(59,130,246,.15)" : "rgba(245,158,11,.15)",
              color:      isLong ? "var(--color-long)"    : "var(--color-short)",
              border:     `1px solid ${isLong ? "rgba(59,130,246,.35)" : "rgba(245,158,11,.35)"}`,
            }}
          >
            {isLong ? "LONG" : "SHORT"}
          </span>
          <span className="text-sm text-text-mute">
            {trade.contracts} contract{trade.contracts > 1 ? "s" : ""}
          </span>
        </div>

        <div className="text-right shrink-0">
          <div className="label-caps mb-1">NET P&L</div>
          <div
            className="mono text-4xl font-semibold tracking-tight"
            style={{ color: isProfit ? "var(--color-profit)" : "var(--color-loss)" }}
          >
            {formatCurrency(trade.netPnl, { sign: false })}
          </div>
        </div>
      </div>

      {/* Spec grid */}
      <div
        className="grid grid-cols-4 rounded-sm overflow-hidden"
        style={{ gap: 1, background: "var(--color-border)", border: "1px solid var(--color-border)" }}
      >
        {specCells.map(({ label, value, colorClass }) => (
          <div key={label} className="bg-surface px-3 py-2.5">
            <div className="label-caps mb-1">{label}</div>
            <div className={`mono text-lg font-medium ${colorClass ?? "text-text"}`}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
