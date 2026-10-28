import type { ReactElement } from "react"
import Link from "next/link"
import { formatDateTime } from "~/helpers/format"
import { formatDuration } from "~/helpers/duration"
import { APP_URLS } from "~/constants/app-urls"
import { TRADES } from "~/constants/copies/trades"
import { TradeFormModal } from "~/components/trades/trade-form-modal.client"
import type { Trade } from "~/types/trade"
import type { Account } from "~/types/account"
import type { Playbook } from "~/types/playbook"
import { TradeDeleteButton } from "./trade-delete-button.client"
import { TradeGradeBadge } from "./trade-grade-badge.client"

export function TradeViewHeader({ trade, accounts, playbooks, timezone }: {
  trade:      Trade
  accounts:   Account[]
  playbooks: Playbook[]
  timezone:   string
}): ReactElement {
  const num = trade.tradeNumber !== null
    ? trade.tradeNumber.toString().padStart(4, "0")
    : trade.id.slice(0, 8)

  return (
    <header className="flex items-center gap-3 md:gap-4 px-4 md:px-7 py-3.5 border-b border-border bg-bg shrink-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-text">
            {TRADES.VIEW.TRADE_NUM_PREFIX}{num}
          </h1>
          <TradeGradeBadge playbooks={playbooks} />
        </div>
        <div className="mono text-sm text-text-mute mt-0.5">
          {formatDateTime(trade.entryTime, timezone)} · {TRADES.VIEW.HELD} {formatDuration(trade.entryTime, trade.exitTime)}
        </div>
      </div>
      <TradeFormModal
        mode="edit"
        accounts={accounts}
        playbooks={playbooks}
        initialTrade={trade}
      />
      <TradeDeleteButton tradeId={trade.id} />
      <Link
        href={APP_URLS.TRADES}
        className="flex items-center gap-1.5 px-3 h-7.5 rounded-sm text-base text-text-dim border border-border hover:border-border-hi transition-colors whitespace-nowrap"
      >
        ← Back to list
      </Link>
    </header>
  )
}
