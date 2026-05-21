import type { ReactElement } from "react"
import { COMMON } from "~/constants/copies/common"
import { TRADES } from "~/constants/copies/trades"
import { getAccounts } from "~/services/queries/accounts"
import { AccountSelector } from "~/components/account-selector.client"

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>
}): Promise<ReactElement> {
  const params    = await searchParams
  const accountId = params.account ?? null

  const accountsResult = await getAccounts()
  const accounts = accountsResult.success ? accountsResult.data : []

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{TRADES.LIST.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{TRADES.LIST.SUBTITLE}</div>
        </div>
        <div className="ml-auto">
          {accounts.length > 0 && (
            <AccountSelector accounts={accounts} value={accountId} />
          )}
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center text-text-mute text-md">
        {COMMON.COMING_SOON}
      </div>
    </div>
  )
}
