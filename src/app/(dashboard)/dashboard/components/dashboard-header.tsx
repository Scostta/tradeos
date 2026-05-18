import type { ReactElement } from "react"
import type { RangeKey } from "~/types/metrics"
import type { Account } from "~/types"
import { DASHBOARD } from "~/constants/copies/dashboard"
import { RangeSelector } from "~/components/range-selector.client"
import { AccountSelector } from "~/components/account-selector.client"

type Props = {
  range: RangeKey
  accounts: Account[]
  accountId: string | null
}

export function DashboardHeader({ range, accounts, accountId }: Props): ReactElement {
  return (
    <header className="flex items-center gap-4 px-7 py-3 border-b border-border bg-bg shrink-0">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">{DASHBOARD.TITLE}</h1>
        <div className="mono text-sm text-text-mute mt-0.5">{DASHBOARD.SUBTITLE}</div>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        {accounts.length > 1 && (
          <AccountSelector accounts={accounts} value={accountId} />
        )}
        <RangeSelector value={range} />
      </div>
    </header>
  )
}
