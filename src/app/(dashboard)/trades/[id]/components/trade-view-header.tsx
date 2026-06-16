import type { ReactElement } from "react"
import Link from "next/link"
import { formatDateTime } from "~/helpers/format"
import { formatDuration } from "~/helpers/duration"
import { APP_URLS } from "~/constants/app-urls"
import { TradeFormModal } from "~/components/trades/trade-form-modal.client"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import { meetsSetup } from "~/lib/calculations/playbook-adherence"
import type { Trade } from "~/types/trade"
import type { Account } from "~/types/account"
import type { Playbook } from "~/types/playbook"
import { TradeDeleteButton } from "./trade-delete-button.client"

export function TradeViewHeader({ trade, accounts, playbooks }: {
  trade:      Trade
  accounts:   Account[]
  playbooks: Playbook[]
}): ReactElement {
  const num = trade.tradeNumber !== null
    ? trade.tradeNumber.toString().padStart(4, "0")
    : trade.id.slice(0, 8)

  // Adherence badge: only when the trade's playbook has rules and adherence was recorded.
  const playbookRules = parsePlaybookRules(playbooks.find(p => p.id === trade.playbookId)?.rules ?? null)
  const showAdherence = playbookRules.all.length > 0 && trade.followedRules != null
  const setupOk       = showAdherence && meetsSetup(playbookRules, trade)

  return (
    <header className="flex items-center gap-4 px-7 py-3.5 border-b border-border bg-bg shrink-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Trade #{num}
          </h1>
          {showAdherence && (
            <span
              className="text-xxs mono font-semibold tracking-wider rounded-sm px-2 py-0.5"
              style={{
                color:      setupOk ? "var(--color-profit)" : "#f59e0b",
                background: setupOk ? "color-mix(in srgb, var(--color-profit) 14%, transparent)" : "color-mix(in srgb, #f59e0b 14%, transparent)",
              }}
            >
              {setupOk ? "SETUP MET" : "SETUP BROKEN"}
            </span>
          )}
        </div>
        <div className="mono text-sm text-text-mute mt-0.5">
          {formatDateTime(trade.entryTime)} · held {formatDuration(trade.entryTime, trade.exitTime)}
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
