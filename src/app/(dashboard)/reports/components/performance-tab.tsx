import type { ReactElement } from "react"
import type { PerformanceSummary, CumPoint, AvgWinLossPoint } from "~/types/reports"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency, formatPct, formatDurationMs } from "~/helpers/format"
import { SignedAreaChart } from "~/components/charts/signed-area-chart.client"
import { MiniBars } from "~/components/charts/mini-bars.client"
import { ChartFrame } from "./chart-frame"

type Props = {
  summary:    PerformanceSummary
  cumPoints:  CumPoint[]
  avgWinLoss: AvgWinLossPoint[]
}

type StatCell = {
  label: string
  value: string
  kind:  "profit" | "loss" | "neutral"
}

function buildSummaryGrid(s: PerformanceSummary): StatCell[] {
  return [
    {
      label: REPORTS.PERFORMANCE.STATS.NET_PNL,
      value: formatCurrency(s.netPnl, { sign: false, decimals: 2 }),
      kind:  s.netPnl >= 0 ? "profit" : "loss",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.PROFIT_FACTOR,
      value: s.profitFactor.toFixed(2),
      kind:  s.profitFactor >= 1 ? "profit" : "loss",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.WIN_RATE,
      value: formatPct(s.winRate),
      kind:  s.winRate >= 0.5 ? "profit" : "neutral",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.AVG_NET_TRADE_PNL,
      value: formatCurrency(s.avgNetTradePnl, { sign: true, decimals: 2 }),
      kind:  s.avgNetTradePnl >= 0 ? "profit" : "loss",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.AVG_DAILY_VOLUME,
      value: s.avgDailyVolume.toFixed(2),
      kind:  "neutral",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.AVG_DAILY_NET_PNL,
      value: formatCurrency(s.avgDailyNetPnl, { sign: true, decimals: 2 }),
      kind:  s.avgDailyNetPnl >= 0 ? "profit" : "loss",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.LOGGED_DAYS,
      value: s.loggedDays.toString(),
      kind:  "neutral",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.TRADE_EXPECTANCY,
      value: formatCurrency(s.tradeExpectancy, { sign: true, decimals: 2 }),
      kind:  s.tradeExpectancy >= 0 ? "profit" : "loss",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.AVG_DAILY_WIN_LOSS,
      value: s.avgDailyWinLoss.toFixed(2),
      kind:  s.avgDailyWinLoss >= 1 ? "profit" : "neutral",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.AVG_TRADE_WIN_LOSS,
      value: s.avgTradeWinLoss.toFixed(2),
      kind:  s.avgTradeWinLoss >= 1 ? "profit" : "neutral",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.MAX_DAILY_DRAWDOWN,
      value: formatCurrency(s.maxDailyDrawdown, { sign: true, decimals: 2 }),
      kind:  "loss",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.AVG_DAILY_DRAWDOWN,
      value: formatCurrency(s.avgDailyDrawdown, { sign: true, decimals: 2 }),
      kind:  "loss",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.AVG_HOLD_TIME,
      value: formatDurationMs(s.avgHoldTimeMs),
      kind:  "neutral",
    },
    {
      label: REPORTS.PERFORMANCE.STATS.AVG_DAILY_WIN_PCT,
      value: formatPct(s.avgDailyWinPct),
      kind:  s.avgDailyWinPct >= 0.5 ? "profit" : "neutral",
    },
  ]
}

const KIND_COLOR: Record<StatCell["kind"], string> = {
  profit:  "var(--color-profit)",
  loss:    "var(--color-loss)",
  neutral: "var(--color-text)",
}

export function PerformanceTab({ summary, cumPoints, avgWinLoss }: Props): ReactElement {
  const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"
  const grid     = buildSummaryGrid(summary)

  const cumData = cumPoints.map(p => ({
    label: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
    v:     p.v,
  }))

  // Show the win value when positive, loss when negative — single signed bar per day
  const signedBars = avgWinLoss.map(p => ({
    label: p.label,
    v:     p.win !== 0 ? p.win : p.loss,
  }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ChartFrame
          label={REPORTS.PERFORMANCE.CHART_NET_PNL}
          legend={[{ label: REPORTS.PERFORMANCE.LEGEND_NET_PNL, color: "var(--color-profit)" }]}
        >
          {cumData.length > 0 ? (
            <SignedAreaChart
              uid="perf-cum"
              data={cumData}
              height={250}
              fewLabels
            />
          ) : (
            <div
              style={{
                height:         250,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                color:          "var(--color-text-mute)",
                fontSize:       12,
              }}
            >
              {REPORTS.REPORT_DETAIL.NO_DATA}
            </div>
          )}
        </ChartFrame>

        <ChartFrame
          label={REPORTS.PERFORMANCE.CHART_AVG_WIN_LOSS}
          legend={[{ label: REPORTS.PERFORMANCE.LEGEND_AVG, color: "var(--color-profit)" }]}
        >
          {signedBars.length > 0 ? (
            <MiniBars data={signedBars} height={250} mode="signed" />
          ) : (
            <div
              style={{
                height:         250,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                color:          "var(--color-text-mute)",
                fontSize:       12,
              }}
            >
              {REPORTS.REPORT_DETAIL.NO_DATA}
            </div>
          )}
        </ChartFrame>
      </div>

      {/* Summary stats grid */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding:        "12px 16px",
            borderBottom:   "1px solid var(--color-border)",
            display:        "flex",
            justifyContent: "space-between",
            alignItems:     "center",
          }}
        >
          <div
            style={{
              fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
              color: "var(--color-text-mute)", textTransform: "uppercase",
            }}
          >
            {REPORTS.PERFORMANCE.SUMMARY_LABEL}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          {grid.map((cell, i) => (
            <div
              key={i}
              style={{ padding: "16px 18px", background: "var(--color-surface)" }}
            >
              <div
                style={{
                  fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
                  color: "var(--color-text-mute)", textTransform: "uppercase",
                  marginBottom: 7,
                }}
              >
                {cell.label}
              </div>
              <div
                style={{
                  fontFamily:         monoFont,
                  fontSize:           19,
                  fontWeight:         600,
                  color:              KIND_COLOR[cell.kind],
                  letterSpacing:      "-0.01em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {cell.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
