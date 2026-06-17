import type { ReactElement } from "react"
import { getInsightsView } from "~/services/queries/insights"
import { getAccounts } from "~/services/queries/accounts"
import { InsightsCard } from "~/components/insights/insights-card.client"
import { INSIGHTS } from "~/constants/copies/insights"
import { AccountSelector } from "~/components/account-selector.client"

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>
}): Promise<ReactElement> {
  const params    = await searchParams
  const accountId = params.account ?? null

  const [result, accountsResult] = await Promise.all([
    getInsightsView(accountId),
    getAccounts(),
  ])
  const accounts = accountsResult.success ? accountsResult.data : []

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-col md:flex-row md:items-center gap-3 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{INSIGHTS.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{INSIGHTS.PAGE_SUBTITLE}</div>
        </div>
        {accounts.length > 0 && (
          <div className="md:ml-auto">
            <AccountSelector accounts={accounts} value={accountId} />
          </div>
        )}
      </header>

      <div className="flex-1 overflow-auto page-pad flex flex-col gap-4">
        {result.success ? (
          <InsightsCard view={result.data} accountId={accountId} full />
        ) : (
          <div className="card p-4 text-sm text-loss">{INSIGHTS.ERRORS.DEFAULT}</div>
        )}
      </div>
    </div>
  )
}
