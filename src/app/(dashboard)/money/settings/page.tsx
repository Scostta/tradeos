import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import { transactionsByRule } from "~/lib/finance/match-rule"
import {
  getFinanceCategories,
  getFinanceRules,
  getFinanceSettings,
  getTransactions,
} from "~/services/queries/finance"
import { MoneyOnboarding } from "../components/money-onboarding.client"
import { RulesView } from "./components/rules-view.client"

const S = MONEY.SETTINGS

// §5.6 /money/settings. De momento solo Rules: cada regla con los movimientos
// que categoriza hoy (calculado, no el contador histórico `hits`).
export default async function MoneySettingsPage(): Promise<ReactElement> {
  const settingsResult = await getFinanceSettings()
  if (settingsResult.success && !settingsResult.data) {
    return <div className="flex flex-col h-full"><MoneyOnboarding /></div>
  }

  const [rulesResult, categoriesResult, txResult] = await Promise.all([
    getFinanceRules(),
    getFinanceCategories(),
    getTransactions({}),
  ])
  if (!settingsResult.success || !rulesResult.success || !categoriesResult.success || !txResult.success) {
    return <div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div>
  }

  const owned = transactionsByRule(txResult.data, rulesResult.data)
  const counts = Object.fromEntries(rulesResult.data.map(r => [r.id, owned.get(r.id)?.length ?? 0]))

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-text">{S.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5 truncate">{S.SUBTITLE}</div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-auto page-pad">
        <RulesView rules={rulesResult.data} categories={categoriesResult.data} counts={counts} />
      </div>
    </div>
  )
}
