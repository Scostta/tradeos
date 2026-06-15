import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"
import { formatCurrency } from "~/helpers/format"
import { AccountSelector } from "~/components/account-selector.client"
import { TradeFormModal } from "~/components/trades/trade-form-modal.client"
import type { Account } from "~/types/account"
import type { Strategy } from "~/types/strategy"

type Props = {
  totalCount: number
  totalNet:   number
  accounts:   Account[]
  accountId:  string | null
  strategies: Strategy[]
}

export function TradesHeader(props: Props): ReactElement {
  const { totalCount, totalNet, accounts, accountId, strategies } = props

  return (
    <header className="flex flex-wrap items-center gap-3 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">
          {TRADES.LIST.TITLE}
        </h1>
        <div className="mono text-sm text-text-mute mt-0.5">
          {totalCount} trades · {formatCurrency(totalNet, { sign: false })} net
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {accounts.length > 0 && (
          <TradeFormModal
            mode="create"
            accounts={accounts}
            strategies={strategies}
            defaultAccountId={accountId}
          />
        )}
        {accounts.length > 0 && (
          <AccountSelector accounts={accounts} value={accountId} />
        )}
      </div>
    </header>
  )
}
