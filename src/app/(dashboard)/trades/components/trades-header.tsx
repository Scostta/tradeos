import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"
import { formatCurrency } from "~/helpers/format"
import { PlusIcon } from "~/lib/ui/icons/plus-icon"
import { AccountSelector } from "~/components/account-selector.client"
import type { Account } from "~/types/account"

type Props = {
  totalCount: number
  totalNet:   number
  accounts:   Account[]
  accountId:  string | null
}

export function TradesHeader(props: Props): ReactElement {
  const { totalCount, totalNet, accounts, accountId } = props

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
        <button
          className="btn-accent inline-flex items-center gap-1.5 opacity-50 cursor-not-allowed"
          disabled
          title="Coming soon"
        >
          <PlusIcon />
          {TRADES.LIST.NEW_TRADE}
        </button>
        {accounts.length > 0 && (
          <AccountSelector accounts={accounts} value={accountId} />
        )}
      </div>
    </header>
  )
}
