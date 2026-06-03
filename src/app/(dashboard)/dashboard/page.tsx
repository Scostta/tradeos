import type { ReactElement } from "react"
import { tradesRangeSchema } from "~/types/trade-filters"
import type { TradesRange } from "~/types/trade-filters"
import { getDashboardData } from "~/services/queries/dashboard"
import { getAccounts } from "~/services/queries/accounts"
import { DASHBOARD } from "~/constants/copies/dashboard"
import { TRADES } from "~/constants/copies/trades"
import { FilterBar } from "~/components/filter-bar"
import { RangeSelector } from "~/components/range-selector.client"
import { DashboardHeader } from "./components/dashboard-header"
import { MetricsRow } from "./components/metrics-row"
import { EquityCurveCard } from "./components/equity-curve-card.client"
import { PnlByDayCard } from "./components/pnl-by-day-card.client"
import { RecentTradesCard } from "./components/recent-trades-card.client"

const RANGE_OPTIONS = [
  { id: "today", label: TRADES.LIST.RANGE.DAY   },
  { id: "week",  label: TRADES.LIST.RANGE.WEEK  },
  { id: "month", label: TRADES.LIST.RANGE.MONTH },
  { id: "ytd",   label: TRADES.LIST.RANGE.YEAR  },
  { id: "all",   label: TRADES.LIST.RANGE.ALL   },
] as const

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; account?: string }>
}): Promise<ReactElement> {
  const params    = await searchParams
  const parsed    = tradesRangeSchema.safeParse(params.range)
  const range: TradesRange = parsed.success ? parsed.data : "all"
  const accountId = params.account ?? null

  const [result, accountsResult] = await Promise.all([
    getDashboardData(range, accountId),
    getAccounts(),
  ])
  const accounts = accountsResult.success ? accountsResult.data : []

  const filterBar = (
    <FilterBar
      actions={<RangeSelector value={range} options={RANGE_OPTIONS} />}
    />
  )

  if (!result.success) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader accounts={accounts} accountId={accountId} />
        {filterBar}
        <div className="flex-1 flex items-center justify-center p-7">
          <div className="card p-5 max-w-sm text-center">
            <div className="text-md font-semibold text-text mb-1">{DASHBOARD.ERROR.TITLE}</div>
            <div className="text-sm text-text-mute">{DASHBOARD.ERROR.MESSAGE}</div>
          </div>
        </div>
      </div>
    )
  }

  const { metrics, equityCurve, pnlByDow, recentTrades } = result.data

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader accounts={accounts} accountId={accountId} />
      {filterBar}
      <div className="flex-1 overflow-auto page-pad flex flex-col gap-4">
        <MetricsRow metrics={metrics} />

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <EquityCurveCard data={equityCurve} netPnl={metrics.netPnl} />
          </div>
          <div className="w-full lg:w-80 shrink-0">
            <PnlByDayCard data={pnlByDow} />
          </div>
        </div>

        <RecentTradesCard trades={recentTrades} />
      </div>
    </div>
  )
}
