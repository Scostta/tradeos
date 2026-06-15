"use client"

import { useState } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { StatsPanel } from "./stats-panel"
import { TradeTestChart } from "./chart.client"
import { NotesBar } from "./notes-bar.client"
import type { Trade } from "~/types/trade"
import type { Account } from "~/types/account"
import type { Strategy } from "~/types/strategy"
import { formatCurrency } from "~/helpers/format"
import { formatDuration } from "~/helpers/duration"

type PanelTab = "stats" | "strategy" | "executions" | "attachments"

type Props = {
  trade:    Trade
  account:  Account | null
  strategy: Strategy | null
}

export function TradeTestShell({ trade, account, strategy }: Props) {
  const [tab, setTab] = useState<PanelTab>("stats")

  const num      = trade.tradeNumber !== null
    ? trade.tradeNumber.toString().padStart(4, "0")
    : trade.id.slice(0, 8)
  const isProfit = trade.netPnl >= 0
  const isLong   = trade.direction === "long"
  const holdTime = formatDuration(trade.entryTime, trade.exitTime)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <header
        className="flex items-center gap-4 px-4 shrink-0 border-b border-border"
        style={{ height: 40, background: "var(--color-surface)" }}
      >
        <Link
          href={APP_URLS.TRADES}
          className="flex items-center gap-1 text-xs text-text-mute hover:text-text-dim transition-colors"
        >
          ← Trades
        </Link>
        <span className="text-border-hi">|</span>
        <span className="mono text-sm font-semibold text-text">Trade #{num}</span>

        <div className="flex items-center gap-2 mono text-xs">
          <span className="text-text-dim">{trade.instrument}</span>
          <span
            className="px-1.5 py-px rounded-xs text-xxs font-semibold"
            style={{
              background: isLong ? "rgba(59,130,246,.15)" : "rgba(245,158,11,.15)",
              color:      isLong ? "var(--color-long)"    : "var(--color-short)",
              border:     `1px solid ${isLong ? "rgba(59,130,246,.3)" : "rgba(245,158,11,.3)"}`,
            }}
          >
            {isLong ? "LONG" : "SHORT"}
          </span>
          <span className="text-text-mute">{trade.contracts}×</span>
          <span className="text-text-mute">·</span>
          <span className="text-text-mute">{holdTime}</span>
        </div>

        <div className="flex-1" />

        <span
          className="mono text-sm font-semibold"
          style={{ color: isProfit ? "var(--color-profit)" : "var(--color-loss)" }}
        >
          {formatCurrency(trade.netPnl, { sign: true })}
        </span>
      </header>

      {/* Body: left panel + chart */}
      <div className="flex flex-1 min-h-0">
        <StatsPanel
          trade={trade}
          account={account}
          strategy={strategy}
          activeTab={tab}
          onTabChange={setTab}
        />

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <TradeTestChart trade={trade} />
          <NotesBar trade={trade} />
        </div>
      </div>
    </div>
  )
}
