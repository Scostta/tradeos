import type { ReactElement } from "react"
import type { TimeOfDayData } from "~/types/reports"
import { REPORTS } from "~/constants/copies/reports"
import { MiniBars } from "~/components/charts/mini-bars.client"
import { ChartFrame } from "./chart-frame"
import { HourWeekdayHeatmap } from "./hour-weekday-heatmap"
import { SummaryTable } from "./summary-table.client"
import { InsightCard, fmtTradesSubinfo, fmtWinRateSubinfo } from "./insight-card"

type Props = {
  data: TimeOfDayData
}

function NoData(): ReactElement {
  return (
    <div
      style={{
        height: 250, display: "flex", alignItems: "center",
        justifyContent: "center", color: "var(--color-text-mute)", fontSize: 12,
      }}
    >
      {REPORTS.TIME.NO_DATA}
    </div>
  )
}

export function TimeTab({ data }: Props): ReactElement {
  const { hourBars, hourBreakdown, weekdayMatrix, session } = data
  const ins = hourBreakdown.insights

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Insight cards — best/worst/most-active/best-win-rate hour */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InsightCard
          kind="up"
          label={REPORTS.REPORT_DETAIL.INSIGHT_BEST}
          value={ins.best.label}
          subinfo={fmtTradesSubinfo(ins.best.trades)}
          pnl={ins.best.pnl}
        />
        <InsightCard
          kind="down"
          label={REPORTS.REPORT_DETAIL.INSIGHT_WORST}
          value={ins.worst.label}
          subinfo={fmtTradesSubinfo(ins.worst.trades)}
          pnl={ins.worst.pnl}
        />
        <InsightCard
          kind="bar"
          label={REPORTS.REPORT_DETAIL.INSIGHT_MOST_ACTIVE}
          value={ins.mostActive.label}
          subinfo={fmtTradesSubinfo(ins.mostActive.trades)}
        />
        <InsightCard
          kind="cup"
          label={REPORTS.REPORT_DETAIL.INSIGHT_WIN_RATE}
          value={ins.bestWinRate.label}
          subinfo={fmtWinRateSubinfo(ins.bestWinRate.winRate, ins.bestWinRate.trades)}
        />
      </div>

      {/* Net P&L by hour */}
      <ChartFrame
        label={REPORTS.TIME.HOUR_CHART_LABEL}
        legend={[{ label: REPORTS.REPORT_DETAIL.LEGEND_NET_PNL, color: "var(--color-profit)" }]}
      >
        {hourBars.length > 0 ? <MiniBars data={hourBars} height={250} mode="signed" /> : <NoData />}
      </ChartFrame>

      {/* Weekday × hour heatmap — the star view for intraday futures */}
      {weekdayMatrix.hours.length > 0 && (
        <HourWeekdayHeatmap matrix={weekdayMatrix} />
      )}

      {/* Hour-of-day table */}
      <SummaryTable firstCol={REPORTS.TIME.HOUR_COL} rows={hourBreakdown.rows} />

      {/* Session breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
            color: "var(--color-text-mute)", textTransform: "uppercase",
          }}
        >
          {REPORTS.TIME.SESSION_LABEL}
        </div>
        <SummaryTable firstCol={REPORTS.TIME.SESSION_COL} rows={session.rows} />
      </div>

      <p style={{ fontSize: 11, color: "var(--color-text-mute)" }}>{REPORTS.TIME.TZ_NOTE}</p>
    </div>
  )
}
