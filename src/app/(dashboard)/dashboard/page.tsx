import type { ReactElement } from "react"
import { rangeKeySchema } from "~/types/metrics"
import type { RangeKey } from "~/types/metrics"
import { getDashboardData } from "~/services/queries/dashboard"
import { getAccounts } from "~/services/queries/accounts"
import { DASHBOARD } from "~/constants/copies/dashboard"
import { DashboardHeader } from "./components/dashboard-header"
import { MetricsRow } from "./components/metrics-row"
import { EquityCurveCard } from "./components/equity-curve-card.client"
import { PnlByDayCard } from "./components/pnl-by-day-card.client"
import { RecentTradesCard } from "./components/recent-trades-card.client"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; account?: string }>
}): Promise<ReactElement> {
  const params     = await searchParams
  const parsed     = rangeKeySchema.safeParse(params.range)
  const range: RangeKey = parsed.success ? parsed.data : "month"
  const accountId  = params.account ?? null

  const [result, accountsResult] = await Promise.all([
    getDashboardData(range, accountId),
    getAccounts(),
  ])
  const accounts = accountsResult.success ? accountsResult.data : []

  if (!result.success) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader range={range} accounts={accounts} accountId={accountId} />
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
      <DashboardHeader range={range} accounts={accounts} accountId={accountId} />
      <div className="flex-1 overflow-auto page-pad flex flex-col gap-4">
        <MetricsRow metrics={metrics} />

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "1fr 304px" }}
        >
          <EquityCurveCard data={equityCurve} netPnl={metrics.netPnl} />
          <PnlByDayCard data={pnlByDow} />
        </div>

        <RecentTradesCard trades={recentTrades} />
      </div>
    </div>
  )
}
