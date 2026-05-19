"use client"

import type { ReactElement } from "react"
import type { AccountWithStats, AccountType } from "~/types/account"
import { ACCOUNTS } from "~/constants/copies/accounts"
import { cn } from "~/utils/cn"
import { AccountEditor } from "./account-editor.client"

type Props = { account: AccountWithStats }

const TYPE_COLORS: Record<AccountType, string> = {
  real:   "text-text-dim",
  funded: "text-accent",
  demo:   "text-long",
  paper:  "text-text-mute",
}

function formatNetPnl(value: number): string {
  const sign = value >= 0 ? "+" : "-"
  return `${sign}$${Math.abs(value).toFixed(2)}`
}

function formatBalance(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function AccountCard({ account }: Props): ReactElement {
  return (
    <AccountEditor
      account={account}
      renderTrigger={(open) => (
        <div
          role="button"
          onClick={open}
          className="card p-5 flex flex-col gap-4 min-h-48 cursor-pointer transition-colors hover:border-border-hi"
        >
          {/* Top row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: account.color }}
              />
              <div className="min-w-0">
                <p className="text-md font-semibold text-text truncate">{account.name}</p>
                <p className="mono text-xs text-text-mute truncate">
                  {account.broker ?? ACCOUNTS.CARD.NO_BROKER}
                </p>
              </div>
            </div>

            <span className={cn(
              "text-xs mono tracking-wider rounded-sm px-2 py-0.5 border shrink-0",
              account.active
                ? "text-profit bg-profit/10 border-profit/30"
                : "text-text-mute bg-surface-2 border-border"
            )}>
              {account.active ? ACCOUNTS.CARD.STATUS_ACTIVE : ACCOUNTS.CARD.STATUS_ARCHIVED}
            </span>
          </div>

          {/* Account type badge */}
          <div>
            <span className={cn(
              "text-xs mono border border-border bg-surface-2 rounded-sm px-2 py-0.5",
              TYPE_COLORS[account.accountType]
            )}>
              {ACCOUNTS.TYPE_LABELS[account.accountType]}
            </span>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 gap-px bg-border rounded-sm border border-border overflow-hidden">
            <div className="bg-surface p-3">
              <div className="label-caps mb-1">{ACCOUNTS.CARD.TRADES_LABEL}</div>
              <div className="mono text-lg font-semibold text-text">{account.tradeCount}</div>
            </div>
            <div className="bg-surface p-3">
              <div className="label-caps mb-1">{ACCOUNTS.CARD.NET_PNL_LABEL}</div>
              {account.tradeCount === 0 ? (
                <div className="mono text-lg font-semibold text-text-mute">—</div>
              ) : (
                <div className={cn(
                  "mono text-lg font-semibold",
                  account.netPnl >= 0 ? "text-profit" : "text-loss"
                )}>
                  {formatNetPnl(account.netPnl)}
                </div>
              )}
            </div>
          </div>

          {/* Initial balance */}
          <div className="flex items-center justify-between">
            <span className="label-caps">{ACCOUNTS.CARD.BALANCE_LABEL}</span>
            <span className={cn(
              "mono text-sm",
              account.initialBalance != null ? "text-text-dim" : "text-text-mute"
            )}>
              {account.initialBalance != null
                ? formatBalance(account.initialBalance)
                : ACCOUNTS.CARD.BALANCE_NOT_SET}
            </span>
          </div>
        </div>
      )}
    />
  )
}
