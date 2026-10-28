import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import {
  getFinanceAccounts,
  getFinanceCategories,
  getFinanceRules,
  getFinanceSettings,
  getTransactions,
  getTransactionsIndex,
} from "~/services/queries/finance"
import { MoneyOnboarding } from "../components/money-onboarding.client"
import { TransactionsView } from "./components/transactions-view.client"

// §5.2 movimientos. ?month=YYYY-MM | all (por defecto, el último mes con
// datos) y ?queue=1 para la cola de sin categorizar (de todos los meses).
export default async function MoneyTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; queue?: string }>
}): Promise<ReactElement> {
  const params = await searchParams
  const settingsResult = await getFinanceSettings()
  const settings = settingsResult.success ? settingsResult.data : null
  if (settingsResult.success && !settings) {
    return <div className="flex flex-col h-full"><MoneyOnboarding /></div>
  }
  const startDay = settings?.monthStartDay ?? 1

  const indexResult = await getTransactionsIndex(startDay)
  const months = indexResult.success ? indexResult.data.months : []
  const queue = params.queue === "1"
  const month = params.month === "all" || (params.month && /^\d{4}-\d{2}$/.test(params.month))
    ? params.month
    : months[0]?.month ?? "all"

  const [txResult, categoriesResult, rulesResult, accountsResult] = await Promise.all([
    getTransactions(queue ? { uncategorizedOnly: true } : { month: month === "all" ? undefined : month, startDay }),
    getFinanceCategories(),
    getFinanceRules(),
    getFinanceAccounts(),
  ])

  if (!settingsResult.success || !indexResult.success || !txResult.success || !categoriesResult.success || !rulesResult.success || !accountsResult.success) {
    return <div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div>
  }

  return (
    <TransactionsView
      key={`${month}|${queue}`}
      transactions={txResult.data}
      categories={categoriesResult.data}
      rules={rulesResult.data}
      accounts={accountsResult.data}
      months={months}
      month={month}
      queue={queue}
      uncategorized={indexResult.data.uncategorized}
    />
  )
}
