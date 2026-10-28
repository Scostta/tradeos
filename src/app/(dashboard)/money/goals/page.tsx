import type { ReactElement } from "react"
import { ensureMonthsClosed } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { firstOpenMonth } from "~/lib/finance/allocate-savings"
import { monthOf, shiftMonth } from "~/lib/finance/dates"
import { monthlySummary } from "~/lib/finance/summary"
import {
  getFinanceCategories,
  getFinanceSettings,
  getGoals,
  getTransactions,
} from "~/services/queries/finance"
import { MoneyOnboarding } from "../components/money-onboarding.client"
import { GoalsView } from "./components/goals-view.client"

const G = MONEY.GOALS

// §5.4 (artboard 05). Antes de leer los objetivos se cierran los meses ya
// terminados (§4.5): la primera visita del mes suma su ahorro a cada objetivo.
export default async function MoneyGoalsPage(): Promise<ReactElement> {
  await ensureMonthsClosed()
  const settingsResult = await getFinanceSettings()
  const settings = settingsResult.success ? settingsResult.data : null
  if (settingsResult.success && !settings) {
    return <div className="flex flex-col h-full"><MoneyOnboarding /></div>
  }

  const [goalsResult, txResult, categoriesResult] = await Promise.all([
    getGoals(),
    getTransactions({}),
    getFinanceCategories(),
  ])
  if (!settings || !goalsResult.success || !txResult.success || !categoriesResult.success) {
    return <div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div>
  }

  const today = new Date().toISOString().slice(0, 10)
  const startDay = settings.monthStartDay
  const current = monthOf(today, startDay)
  const thisMonth = monthlySummary(txResult.data, categoriesResult.data, current, { startDay, today }).realSavings

  // Media de los 6 meses anteriores con datos.
  const first = txResult.data.reduce<string | null>((m, t) => (m == null || t.bookedAt < m ? t.bookedAt : m), null)
  const previous = Array.from({ length: 6 }, (_, i) => shiftMonth(current, -(i + 1)))
    .filter(m => first != null && m >= monthOf(first, startDay))
    .map(m => monthlySummary(txResult.data, categoriesResult.data, m, { startDay }).realSavings)
  const avg6 = previous.length ? previous.reduce((a, b) => a + b, 0) / previous.length : null

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-text">{G.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5 truncate">{G.SUBTITLE}</div>
        </div>
        <a href="#new-goal" className="btn-accent ml-auto">{G.NEW}</a>
      </header>
      <GoalsView
        goals={goalsResult.data.filter(g => g.status !== "archived")}
        thisMonth={thisMonth}
        avg6={avg6}
        openMonth={firstOpenMonth(current, settings.closedThrough)}
        closedThrough={settings.closedThrough}
      />
    </div>
  )
}
