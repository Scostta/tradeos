import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { MONEY } from "~/constants/copies/money"
import { monthOf } from "~/lib/finance/dates"
import { transactionsByRule } from "~/lib/finance/match-rule"
import {
  getFinanceAccounts,
  getFinanceCategories,
  getFinanceRules,
  getFinanceSettings,
  getTransactions,
} from "~/services/queries/finance"
import { cn } from "~/utils/cn"
import { MoneyOnboarding } from "../components/money-onboarding.client"
import { AccountsView } from "./components/accounts-view.client"
import { CategoriesView } from "./components/categories-view.client"
import { MonthView } from "./components/month-view.client"
import { RulesView } from "./components/rules-view.client"

const S = MONEY.SETTINGS

const TABS = ["accounts", "categories", "rules", "month"] as const
type Tab = (typeof TABS)[number]

// §5.6 /money/settings, una pestaña por ?tab= (Accounts, Categories, Rules,
// Month). En Rules, el recuento de cada regla es lo que categoriza hoy
// (calculado), no el contador histórico `hits`.
export default async function MoneySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}): Promise<ReactElement> {
  const params = await searchParams
  const tab: Tab = TABS.find(t => t === params.tab) ?? TABS[0]

  const settingsResult = await getFinanceSettings()
  if (settingsResult.success && !settingsResult.data) {
    return <div className="flex flex-col h-full"><MoneyOnboarding /></div>
  }

  const [accountsResult, rulesResult, categoriesResult, txResult] = await Promise.all([
    getFinanceAccounts(),
    getFinanceRules(),
    getFinanceCategories(),
    getTransactions({}),
  ])
  const settings = settingsResult.success ? settingsResult.data : null
  if (!settings || !accountsResult.success || !rulesResult.success || !categoriesResult.success || !txResult.success) {
    return <div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div>
  }

  const owned = transactionsByRule(txResult.data, rulesResult.data)
  const ruleCounts = Object.fromEntries(rulesResult.data.map(r => [r.id, owned.get(r.id)?.length ?? 0]))
  const categoryCounts: Record<string, number> = {}
  const accountCounts: Record<string, number> = {}
  for (const t of txResult.data) {
    if (t.categoryId) categoryCounts[t.categoryId] = (categoryCounts[t.categoryId] ?? 0) + 1
    if (!t.parentId) accountCounts[t.accountId] = (accountCounts[t.accountId] ?? 0) + 1
  }
  const current = monthOf(new Date().toISOString().slice(0, 10), settings.monthStartDay)

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-text">{S.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5 truncate">{S.SUBTITLE}</div>
        </div>
      </header>

      <div className="flex items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
        <div className="inline-flex items-center rounded-md border border-border overflow-x-auto max-w-full">
          {TABS.map((t, i) => (
            <Link
              key={t} href={`${APP_URLS.MONEY_SETTINGS}?tab=${t}`}
              className={cn(
                "px-3 py-1.5 text-sm whitespace-nowrap border-t",
                i > 0 && "border-l border-l-border",
                tab === t ? "bg-surface-2 text-text border-t-accent" : "text-text-mute border-t-transparent hover:text-text-dim",
              )}
            >
              {S.TABS[t]}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto page-pad">
        {tab === "accounts" && <AccountsView accounts={accountsResult.data} counts={accountCounts} defaultAccount={settings.defaultAccount} />}
        {tab === "categories" && <CategoriesView categories={categoriesResult.data} counts={categoryCounts} />}
        {tab === "rules" && <RulesView rules={rulesResult.data} categories={categoriesResult.data} counts={ruleCounts} />}
        {tab === "month" && <MonthView monthStartDay={settings.monthStartDay} closedThrough={settings.closedThrough} current={current} />}
      </div>
    </div>
  )
}
