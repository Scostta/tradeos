import type { ReactElement } from "react"
import type { DashboardMetrics } from "~/types/metrics"
import { DASHBOARD } from "~/constants/copies/dashboard"
import { formatCurrency, formatPct } from "~/helpers/format"
import { MetricCard } from "./metric-card"
import { WinRateDonut } from "./win-rate-donut"

type Props = { metrics: DashboardMetrics }

function pfSub(pf: number): string {
  if (pf >= 1.5) return DASHBOARD.METRICS.PF_HEALTHY
  if (pf >= 1)   return DASHBOARD.METRICS.PF_POSITIVE
  return DASHBOARD.METRICS.PF_REVIEW
}

function sharpeSub(s: number): string {
  if (s === 0)   return DASHBOARD.METRICS.SHARPE_NA
  if (s >= 2)    return DASHBOARD.METRICS.SHARPE_STRONG
  if (s >= 1)    return DASHBOARD.METRICS.SHARPE_GOOD
  return DASHBOARD.METRICS.SHARPE_WEAK
}

export function MetricsRow({ metrics }: Props): ReactElement {
  const { netPnl, winRate, profitFactor, maxDrawdown, avgWin, avgLoss, sharpeRatio, winners, losers } = metrics
  const sharpeClass = sharpeRatio > 0 ? "text-profit" : sharpeRatio < 0 ? "text-loss" : "text-text"
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      <MetricCard
        label={DASHBOARD.METRICS.NET_PNL}
        value={formatCurrency(netPnl, { sign: false, decimals: 0 })}
        valueClass={netPnl >= 0 ? "text-profit" : "text-loss"}
      />
      <MetricCard
        label={DASHBOARD.METRICS.WIN_RATE}
        value={formatPct(winRate)}
        accent={<WinRateDonut pct={winRate} />}
        sub={`${winners}W · ${losers}L`}
      />
      <MetricCard
        label={DASHBOARD.METRICS.PROFIT_FACTOR}
        value={profitFactor.toFixed(2)}
        sub={pfSub(profitFactor)}
      />
      <MetricCard
        label={DASHBOARD.METRICS.MAX_DRAWDOWN}
        value={formatCurrency(maxDrawdown, { sign: false, decimals: 0 })}
        valueClass="text-loss"
        sub={DASHBOARD.METRICS.SUB_PEAK}
      />
      <MetricCard
        label={DASHBOARD.METRICS.AVG_WIN}
        value={formatCurrency(avgWin, { sign: false, decimals: 0 })}
        valueClass="text-profit"
        sub={`${winners} ${DASHBOARD.METRICS.SUB_WINNERS}`}
      />
      <MetricCard
        label={DASHBOARD.METRICS.AVG_LOSS}
        value={formatCurrency(avgLoss, { sign: false, decimals: 0 })}
        valueClass="text-loss"
        sub={`${losers} ${DASHBOARD.METRICS.SUB_LOSERS}`}
      />
      <MetricCard
        label={DASHBOARD.METRICS.SHARPE}
        value={sharpeRatio === 0 ? "—" : sharpeRatio.toFixed(2)}
        valueClass={sharpeClass}
        sub={sharpeSub(sharpeRatio)}
      />
    </div>
  )
}
