import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { MONEY } from "~/constants/copies/money"
import { monthOf } from "~/lib/finance/dates"
import { yearlyCost } from "~/lib/finance/subscriptions"
import { yearsWithData, yearSummary } from "~/lib/finance/year"
import { getFinanceCategories, getFinanceSettings, getSubscriptions, getTransactions } from "~/services/queries/finance"
import { MoneyOnboarding } from "../components/money-onboarding.client"
import { displayName, fmtEur } from "../components/money-format"
import { Card, Chip, Metric } from "../components/overview/overview-parts"
import { CategoryTable } from "./components/category-table"
import { MonthsChart } from "./components/months-chart"
import { YearSelect } from "./components/year-select.client"

const Y = MONEY.YEAR
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`)

// §5.10 Resumen del año (?year=YYYY; por defecto el año en curso). Las cifras
// salen de monthlySummary() mes a mes, como el Overview.
export default async function MoneyYearPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}): Promise<ReactElement> {
  const params = await searchParams
  const settingsResult = await getFinanceSettings()
  const settings = settingsResult.success ? settingsResult.data : null
  if (settingsResult.success && !settings) {
    return <div className="flex flex-col h-full"><MoneyOnboarding /></div>
  }

  const [txResult, categoriesResult, subsResult] = await Promise.all([getTransactions({}), getFinanceCategories(), getSubscriptions()])
  if (!settings || !txResult.success || !categoriesResult.success || !subsResult.success) {
    return <div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div>
  }

  const today = new Date().toISOString().slice(0, 10)
  const startDay = settings.monthStartDay
  const currentYear = Number(monthOf(today, startDay).slice(0, 4))
  const years = yearsWithData(txResult.data, startDay, today)
  const requested = Number(params.year)
  const year = years.includes(requested) ? requested : currentYear

  const y = yearSummary(txResult.data, categoriesResult.data, year, { startDay, today })
  const subs = subsResult.data
    .filter(s => s.status === "confirmed")
    .map(s => ({ sub: s, yearly: yearlyCost(s) }))
    .sort((a, b) => b.yearly - a.yearly)
  const subsTotal = subs.reduce((a, s) => a + s.yearly, 0)

  const header = (
    <header className="flex flex-wrap items-center gap-3 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text">{MONEY.TITLE}</h1>
        <div className="mono text-sm text-text-mute mt-0.5 truncate">
          {(y.monthsWithData > 0 ? Y.SUBTITLE : Y.SUBTITLE_EMPTY).replace("{year}", String(year)).replace("{n}", String(y.monthsWithData))}
        </div>
      </div>
      <div className="ml-auto"><YearSelect years={years} value={year} current={currentYear} /></div>
    </header>
  )

  if (y.monthsWithData === 0) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="page-pad">
          <div className="card px-6 py-14 flex flex-col items-center gap-3 text-center">
            <div className="text-lg font-semibold text-text">{Y.EMPTY_TITLE.replace("{year}", String(year))}</div>
            <p className="text-md text-text-dim">{Y.EMPTY_BODY}</p>
            <Link href={APP_URLS.MONEY_IMPORT} className="btn-accent">{Y.IMPORT}</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {header}

      {y.uncategorizedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
          <Chip tone="short" href={`${APP_URLS.MONEY_TRANSACTIONS}?queue=1`}>
            {Y.UNCATEGORIZED_CHIP.replace("{n}", String(y.uncategorizedCount))}
          </Chip>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto page-pad flex flex-col gap-3">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 md:gap-3">
          <Metric label={Y.INCOME} value={fmtEur(y.income, { decimals: 0 })} />
          <Metric label={Y.SPENT} value={fmtEur(y.spent, { decimals: 0 })}>
            <span>{Y.SPENT_SUB.replace("{fixed}", fmtEur(y.fixed, { decimals: 0 })).replace("{variable}", fmtEur(y.variable, { decimals: 0 }))}</span>
            {y.avgMonthSpent != null && <span title={Y.AVG_MONTH_HINT}>{Y.AVG_MONTH.replace("{amount}", fmtEur(y.avgMonthSpent, { decimals: 0 }))}</span>}
          </Metric>
          <Metric label={Y.SAVINGS} value={fmtEur(y.realSavings, { decimals: 0 })} tone={y.realSavings < 0 ? "text-loss" : "text-profit"}>
            {y.rate != null && <span>{Y.SAVINGS_SUB.replace("{pct}", pct(y.rate))}</span>}
            {y.savings > 0 && <span>{Y.SAVINGS_EXPLICIT.replace("{amount}", fmtEur(y.savings, { decimals: 0 }))}</span>}
          </Metric>
          <Metric
            label={Y.RATE} value={pct(y.rate)}
            tone={y.rate == null ? "text-text-mute" : y.rate >= 0 ? "text-profit" : "text-loss"}
          >
            <span>{y.rate == null ? Y.NO_INCOME : Y.RATE_SUB}</span>
          </Metric>
        </div>

        <Card title={Y.MONTHS}><MonthsChart months={y.months} /></Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card title={Y.BY_CATEGORY} className="lg:col-span-2">
            <CategoryTable rows={y.categories} months={y.months} categories={categoriesResult.data} />
          </Card>
          <Card title={Y.SUBSCRIPTIONS} link={{ href: APP_URLS.MONEY_SUBSCRIPTIONS, label: MONEY.OVERVIEW.VIEW_ALL }}>
            {subs.length === 0 ? (
              <div className="px-4 py-6 text-sm text-text-mute">{Y.SUBS_EMPTY}</div>
            ) : (
              <div className="flex flex-col">
                {subs.map(({ sub, yearly }) => (
                  <div key={sub.id} className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text truncate">{displayName(sub.counterparty)}</div>
                      <div className="mono text-xs text-text-mute">
                        {fmtEur(sub.amount)} · {MONEY.SUBSCRIPTIONS.CADENCES[sub.cadence]}
                      </div>
                    </div>
                    <span className="mono text-sm text-text shrink-0">{fmtEur(yearly, { decimals: 0 })}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text">{Y.SUBS_TOTAL}</div>
                    <div className="text-xs text-text-mute">{Y.SUBS_HINT}</div>
                  </div>
                  <span className="mono text-md font-semibold text-text shrink-0">{fmtEur(subsTotal, { decimals: 0 })}</span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
