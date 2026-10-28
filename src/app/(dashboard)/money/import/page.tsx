import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import { getFinanceAccounts, getFinanceCategories, getFinanceSettings } from "~/services/queries/finance"
import { MoneyOnboarding } from "../components/money-onboarding.client"
import { ImportFlow } from "./components/import-flow.client"

const I = MONEY.IMPORT

// §3.2 / §5.5: import del export del banco.
export default async function MoneyImportPage(): Promise<ReactElement> {
  const [settingsResult, accountsResult, categoriesResult] = await Promise.all([
    getFinanceSettings(),
    getFinanceAccounts(),
    getFinanceCategories(),
  ])
  const failed = !settingsResult.success || !accountsResult.success || !categoriesResult.success
  const settings = settingsResult.success ? settingsResult.data : null

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{I.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{I.SUBTITLE}</div>
        </div>
      </header>
      {failed ? (
        <div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div>
      ) : !settings ? (
        <MoneyOnboarding />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto page-pad">
          <ImportFlow
            accounts={accountsResult.success ? accountsResult.data.filter(a => a.kind !== "cash" && a.active) : []}
            categories={categoriesResult.success ? categoriesResult.data : []}
            defaultAccountId={settings.defaultAccount}
          />
        </div>
      )}
    </div>
  )
}
