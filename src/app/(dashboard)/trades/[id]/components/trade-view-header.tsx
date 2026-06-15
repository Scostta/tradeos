import type { ReactElement } from "react"
import Link from "next/link"
import { formatDateTime } from "~/helpers/format"
import { formatDuration } from "~/helpers/duration"
import { APP_URLS } from "~/constants/app-urls"
import { TradeFormModal } from "~/components/trades/trade-form-modal.client"
import type { Trade } from "~/types/trade"
import type { Account } from "~/types/account"
import type { Strategy } from "~/types/strategy"
import { TradeDeleteButton } from "./trade-delete-button.client"

export function TradeViewHeader({ trade, accounts, strategies }: {
  trade:      Trade
  accounts:   Account[]
  strategies: Strategy[]
}): ReactElement {
  const num = trade.tradeNumber !== null
    ? trade.tradeNumber.toString().padStart(4, "0")
    : trade.id.slice(0, 8)

  return (
    <header className="flex items-center gap-4 px-7 py-[14px] border-b border-border bg-bg shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text">
          Trade #{num}
        </h1>
        <div className="mono text-sm text-text-mute mt-0.5">
          {formatDateTime(trade.entryTime)} · held {formatDuration(trade.entryTime, trade.exitTime)}
        </div>
      </div>
      <TradeFormModal
        mode="edit"
        accounts={accounts}
        strategies={strategies}
        initialTrade={trade}
      />
      <TradeDeleteButton tradeId={trade.id} />
      <Link
        href={APP_URLS.TRADES}
        className="flex items-center gap-1.5 px-3 h-[30px] rounded-sm text-base text-text-dim border border-border hover:border-border-hi transition-colors whitespace-nowrap"
      >
        ← Back to list
      </Link>
    </header>
  )
}
