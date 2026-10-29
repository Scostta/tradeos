import type { ReactElement } from "react"
import { APP_URLS } from "~/constants/app-urls"
import { MONEY } from "~/constants/copies/money"
import { budgetRows, historyMonths } from "~/lib/finance/budgets"
import { monthOf, shiftMonth } from "~/lib/finance/dates"
import { monthlyCost } from "~/lib/finance/subscriptions"
import { monthlySummary } from "~/lib/finance/summary"
import {
  getBudgets,
  getFinanceCategories,
  getFinanceSettings,
  getSubscriptions,
  getTransactions,
} from "~/services/queries/finance"
import { MonthSelect } from "../components/month-select.client"
import { MoneyOnboarding } from "../components/money-onboarding.client"
import { BudgetsView } from "./components/budgets-view.client"

// §5.9 (artboard 04). ?month=YYYY-MM; por defecto el mes en curso. Se puede
// presupuestar el mes siguiente antes de que empiece. El presupuesto se
// arrastra: sin el suyo, un mes usa el del último que lo tenga.
export default async function MoneyBudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}): Promise<ReactElement> {
  const params = await searchParams
  const settingsResult = await getFinanceSettings()
  const settings = settingsResult.success ? settingsResult.data : null
  if (settingsResult.success && !settings) {
    return <div className="flex flex-col h-full"><MoneyOnboarding /></div>
  }

  const today = new Date().toISOString().slice(0, 10)
  const startDay = settings?.monthStartDay ?? 1
  const current = monthOf(today, startDay)
  const [txResult, categoriesResult, subsResult] = await Promise.all([getTransactions({}), getFinanceCategories(), getSubscriptions()])
  if (!settings || !txResult.success || !categoriesResult.success || !subsResult.success) {
    return <div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div>
  }

  const months = [...new Set([shiftMonth(current, 1), current, ...txResult.data.map(t => monthOf(t.bookedAt, startDay))])].sort().reverse()
  const month = params.month && months.includes(params.month) ? params.month : current
  const budgetsResult = await getBudgets(month)
  if (!budgetsResult.success) {
    return <div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div>
  }

  const isCurrent = month === current
  const summary = monthlySummary(txResult.data, categoriesResult.data, month, { startDay, today: isCurrent ? today : undefined })
  // Subscriptions: presupuesto automático = coste mensual de las confirmadas.
  const subsCategory = categoriesResult.data.find(c => c.name === "Subscriptions" && c.kind === "expense" && !c.archived)
  const subsMonthly = subsResult.data.filter(s => s.status === "confirmed").reduce((a, s) => a + monthlyCost(s), 0)
  const { rows, totals } = budgetRows({
    summary, transactions: txResult.data, categories: categoriesResult.data,
    budgets: new Map(Object.entries(budgetsResult.data.amounts)),
    auto: subsCategory ? { categoryId: subsCategory.id, amount: Math.round(subsMonthly * 100) / 100 } : null,
    startDay, today: isCurrent ? today : undefined,
  })

  return (
    <BudgetsView
      key={`${month}|${JSON.stringify(budgetsResult.data)}`}
      month={month}
      budgetFrom={budgetsResult.data.from}
      phase={month < current ? "past" : month > current ? "next" : "current"}
      rows={rows}
      totals={totals}
      income={summary.income}
      projection={summary.projection}
      history={historyMonths(txResult.data, month, startDay)}
      categories={categoriesResult.data}
      monthSelect={<MonthSelect months={months} value={month} current={current} basePath={APP_URLS.MONEY_BUDGETS} />}
    />
  )
}
