import type { ReactElement } from "react"
import type { Account } from "~/types"
import { DASHBOARD } from "~/constants/copies/dashboard"
import { AccountSelector } from "~/components/account-selector.client"

type Props = {
  accounts:  Account[]
  accountId: string | null
}

export function DashboardHeader({ accounts, accountId }: Props): ReactElement {
  return (
    <header className="flex flex-col md:flex-row md:items-center gap-3 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">{DASHBOARD.TITLE}</h1>
        <div className="mono text-sm text-text-mute mt-0.5">{DASHBOARD.SUBTITLE}</div>
      </div>
      {accounts.length > 0 && (
        <div className="md:ml-auto">
          <AccountSelector accounts={accounts} value={accountId} />
        </div>
      )}
    </header>
  )
}
