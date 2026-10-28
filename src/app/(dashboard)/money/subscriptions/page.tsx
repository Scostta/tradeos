import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import { monthOf } from "~/lib/finance/dates"
import { detectRecurring } from "~/lib/finance/recurring"
import { monthlySummary } from "~/lib/finance/summary"
import {
  getFinanceCategories,
  getFinanceSettings,
  getSubscriptions,
  getTransactions,
} from "~/services/queries/finance"
import { MoneyOnboarding } from "../components/money-onboarding.client"
import { SubscriptionsView } from "./components/subscriptions-view.client"
import type { Evidence } from "./components/subscriptions-view.client"

const S = MONEY.SUBSCRIPTIONS

// §5.3 (artboard 03). La evidencia de cada candidata ("4 charges · every 30 ± 1
// days") se recalcula aquí con detectRecurring: no se guarda en la tabla.
export default async function MoneySubscriptionsPage(): Promise<ReactElement> {
  const settingsResult = await getFinanceSettings()
  const settings = settingsResult.success ? settingsResult.data : null
  if (settingsResult.success && !settings) {
    return <div className="flex flex-col h-full"><MoneyOnboarding /></div>
  }

  const [subsResult, txResult, categoriesResult] = await Promise.all([
    getSubscriptions(),
    getTransactions({}),
    getFinanceCategories(),
  ])
  if (!settingsResult.success || !subsResult.success || !txResult.success || !categoriesResult.success) {
    return <div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div>
  }

  const evidence: Record<string, Evidence> = {}
  for (const c of detectRecurring(txResult.data)) {
    evidence[`${c.counterparty}|${c.cadence}`] = {
      intervalMedian: c.intervalMedian,
      intervalSpread: c.intervalSpread,
      amountSpread:   c.amountSpread,
    }
  }

  // Gasto mensual medio (hasta 12 meses con datos) para "% of your spending".
  const startDay = settings?.monthStartDay ?? 1
  const months = [...new Set(txResult.data.map(t => monthOf(t.bookedAt, startDay)))].sort().slice(-12)
  const spent = months.map(m => monthlySummary(txResult.data, categoriesResult.data, m, { startDay }).spent)
  const avgMonthlySpent = spent.length ? spent.reduce((a, b) => a + b, 0) / spent.length : null

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{S.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{S.SUBTITLE}</div>
        </div>
      </header>
      <SubscriptionsView
        subscriptions={subsResult.data}
        evidence={evidence}
        avgMonthlySpent={avgMonthlySpent}
        today={new Date().toISOString().slice(0, 10)}
      />
    </div>
  )
}
