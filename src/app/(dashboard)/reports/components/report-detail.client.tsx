"use client"

import { useState } from "react"
import type { ReactElement } from "react"
import type { ReportBreakdown } from "~/types/reports"
import { REPORTS } from "~/constants/copies/reports"
import { InsightCard, fmtTradesSubinfo, fmtWinRateSubinfo } from "./insight-card"
import { SummaryTable } from "./summary-table.client"
import { CrossHeatmap } from "./cross-heatmap"
import { ChartFrame } from "./chart-frame"
import { SignedAreaChart } from "~/components/charts/signed-area-chart.client"
import { WinRateLine } from "~/components/charts/win-rate-line.client"

// MVP report keys (Phase 1)
export type ReportKey = "dayTime" | "months" | "symbols" | "playbooks" | "winsLosses"

type SubtabConfig = {
  key:         string
  label:       string
  breakdownIdx: number  // index into `breakdowns` prop
}

type ReportConfig = {
  noun:       string
  firstCol:   string
  subtabs:    SubtabConfig[]
  shortLabel?: boolean  // truncate chart label to 3 chars
}

const REPORT_CONFIGS: Record<ReportKey, ReportConfig> = {
  dayTime: {
    noun:      "day",
    firstCol:  REPORTS.REPORT_DETAIL.SUBTABS.DAYS,
    subtabs:   [
      { key: "days",   label: REPORTS.REPORT_DETAIL.SUBTABS.DAYS,   breakdownIdx: 0 },
      { key: "months", label: REPORTS.REPORT_DETAIL.SUBTABS.MONTHS, breakdownIdx: 1 },
    ],
    shortLabel: true,
  },
  months: {
    noun:     "month",
    firstCol: REPORTS.REPORT_DETAIL.SUBTABS.MONTHS,
    subtabs:  [{ key: "months", label: REPORTS.REPORT_DETAIL.SUBTABS.MONTHS, breakdownIdx: 0 }],
  },
  symbols: {
    noun:     "symbol",
    firstCol: REPORTS.REPORT_DETAIL.SUBTABS.SYMBOLS,
    subtabs:  [{ key: "symbols", label: REPORTS.REPORT_DETAIL.SUBTABS.SYMBOLS, breakdownIdx: 0 }],
  },
  playbooks: {
    noun:     "playbook",
    firstCol: REPORTS.REPORT_DETAIL.SUBTABS.PLAYBOOKS,
    subtabs:  [{ key: "playbooks", label: REPORTS.REPORT_DETAIL.SUBTABS.PLAYBOOKS, breakdownIdx: 0 }],
  },
  winsLosses: {
    noun:     "outcome",
    firstCol: REPORTS.REPORT_DETAIL.SUBTABS.WINS_LOSSES,
    subtabs:  [{ key: "winsLosses", label: REPORTS.REPORT_DETAIL.SUBTABS.WINS_LOSSES, breakdownIdx: 0 }],
  },
}

type Props = {
  reportKey:  ReportKey
  // breakdowns[i] maps to subtabs[i].breakdownIdx — parallel arrays.
  // dayTime passes [dayTimeBreakdown, monthsBreakdown]; others pass [breakdown].
  breakdowns: ReportBreakdown[]
}

export function ReportDetail(props: Props): ReactElement {
  // Note: this component always receives key={reportKey} from the parent shell,
  // so React resets state on reportKey change — no useEffect needed.
  const { reportKey, breakdowns } = props
  const cfg = REPORT_CONFIGS[reportKey]

  const [activeSubtabKey, setActiveSubtabKey] = useState<string>(cfg.subtabs[0]!.key)

  const activeSub = cfg.subtabs.find(s => s.key === activeSubtabKey) ?? cfg.subtabs[0]!
  const activeBreakdown = breakdowns[activeSub.breakdownIdx] ?? breakdowns[0]!

  const { rows, insights, cross } = activeBreakdown

  const chartLabel = (label: string) => cfg.shortLabel ? label.slice(0, 3) : label

  const chartData = rows.map(r => ({ label: chartLabel(r.label), v: r.pnl }))

  const rightLines = [
    {
      label:  REPORTS.REPORT_DETAIL.LEGEND_TRADE_COUNT,
      color:  "var(--color-long)",
      values: rows.map(r => r.trades),
    },
    {
      label:  REPORTS.REPORT_DETAIL.LEGEND_AVG_WIN,
      color:  "var(--color-short)",
      values: rows.map(r => r.avgWin),
    },
  ]

  const winRateData = rows.map(r => ({ label: chartLabel(r.label), v: r.winRate }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Sub-tabs — only shown when there are multiple */}
      {cfg.subtabs.length > 1 && (
        <div style={{ display: "flex", gap: 4 }}>
          {cfg.subtabs.map(sub => {
            const isActive = activeSubtabKey === sub.key
            return (
              <button
                key={sub.key}
                onClick={() => setActiveSubtabKey(sub.key)}
                style={{
                  padding:      "6px 12px",
                  borderRadius: 6,
                  border:       `1px solid ${isActive ? "var(--color-border-hi)" : "transparent"}`,
                  background:   isActive ? "var(--color-surface-2)" : "transparent",
                  color:        isActive ? "var(--color-text)" : "var(--color-text-mute)",
                  fontFamily:   "inherit",
                  fontSize:     12.5,
                  fontWeight:   isActive ? 600 : 500,
                  cursor:       "pointer",
                }}
              >
                {sub.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Insight cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <InsightCard
          kind="up"
          label={`Best performing ${cfg.noun}`}
          value={insights.best.label}
          subinfo={fmtTradesSubinfo(insights.best.trades)}
          pnl={insights.best.pnl}
        />
        <InsightCard
          kind="down"
          label={`Least performing ${cfg.noun}`}
          value={insights.worst.label}
          subinfo={fmtTradesSubinfo(insights.worst.trades)}
          pnl={insights.worst.pnl}
        />
        <InsightCard
          kind="bar"
          label={`Most active ${cfg.noun}`}
          value={insights.mostActive.label}
          subinfo={fmtTradesSubinfo(insights.mostActive.trades)}
        />
        <InsightCard
          kind="cup"
          label="Best win rate"
          value={insights.bestWinRate.label}
          subinfo={fmtWinRateSubinfo(insights.bestWinRate.winRate, insights.bestWinRate.trades)}
        />
      </div>

      {/* Dual chart + win% line */}
      {rows.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ChartFrame
            label={REPORTS.REPORT_DETAIL.CHART_NET_PNL}
            legend={[
              { label: REPORTS.REPORT_DETAIL.LEGEND_NET_PNL,    color: "var(--color-profit)" },
              { label: REPORTS.REPORT_DETAIL.LEGEND_TRADE_COUNT, color: "var(--color-long)"   },
              { label: REPORTS.REPORT_DETAIL.LEGEND_AVG_WIN,     color: "var(--color-short)"  },
            ]}
          >
            <SignedAreaChart
              uid={`rd-${reportKey}-${activeSubtabKey}`}
              data={chartData}
              rightLines={rightLines}
              height={250}
            />
          </ChartFrame>

          <ChartFrame
            label={REPORTS.REPORT_DETAIL.CHART_WIN_PCT}
            legend={[{ label: REPORTS.REPORT_DETAIL.LEGEND_WIN_PCT, color: "var(--color-long)" }]}
          >
            <WinRateLine
              uid={`wr-${reportKey}-${activeSubtabKey}`}
              data={winRateData}
              height={250}
            />
          </ChartFrame>
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding:        "48px 24px",
            textAlign:      "center",
            color:          "var(--color-text-mute)",
            fontSize:       14,
          }}
        >
          {REPORTS.REPORT_DETAIL.NO_DATA}
        </div>
      )}

      {/* Summary table */}
      {rows.length > 0 && (
        <SummaryTable firstCol={cfg.firstCol} rows={rows} />
      )}

      {/* Cross-analysis heatmap */}
      {cross.cols.length > 0 && rows.length > 0 && (
        <CrossHeatmap cross={cross} />
      )}
    </div>
  )
}
