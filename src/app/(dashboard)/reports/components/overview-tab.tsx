import type { ReactElement } from "react"
import type { OverviewData, OverviewStats } from "~/types/reports"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency, formatDurationMs } from "~/helpers/format"
import { SignedAreaChart } from "~/components/charts/signed-area-chart.client"
import { MiniBars } from "~/components/charts/mini-bars.client"

type Props = {
  data: OverviewData
}

type Kind = "profit" | "loss" | "neutral"
type StatItem = { label: string; value: string; kind: Kind }

const KIND_COLOR: Record<Kind, string> = {
  profit:  "var(--color-profit)",
  loss:    "var(--color-loss)",
  neutral: "var(--color-text)",
}

const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

const money    = (n: number, sign = true): string => formatCurrency(n, { sign, decimals: 2 })
const pnlKind  = (n: number): Kind => (n >= 0 ? "profit" : "loss")

function buildLeftColumn(s: OverviewStats): StatItem[] {
  const C = REPORTS.OVERVIEW.STATS
  return [
    { label: C.TOTAL_PNL,         value: money(s.totalPnl, false),         kind: pnlKind(s.totalPnl) },
    { label: C.AVG_DAILY_VOLUME,  value: s.avgDailyVolume.toFixed(2),      kind: "neutral" },
    { label: C.AVG_WINNING_TRADE, value: money(s.avgWinningTrade),         kind: "profit" },
    { label: C.AVG_LOSING_TRADE,  value: money(s.avgLosingTrade),          kind: "loss" },
    { label: C.TOTAL_TRADES,      value: s.totalTrades.toString(),         kind: "neutral" },
    { label: C.WINNING_TRADES,    value: s.winningTrades.toString(),       kind: "neutral" },
    { label: C.LOSING_TRADES,     value: s.losingTrades.toString(),        kind: "neutral" },
    { label: C.MAX_CONSEC_WINS,   value: s.maxConsecWins.toString(),       kind: "neutral" },
    { label: C.MAX_CONSEC_LOSSES, value: s.maxConsecLosses.toString(),     kind: "neutral" },
    { label: C.TOTAL_COMMISSIONS, value: money(s.totalCommissions, false), kind: "loss" },
    { label: C.LARGEST_PROFIT,    value: money(s.largestProfit, false),    kind: "profit" },
    { label: C.LARGEST_LOSS,      value: money(s.largestLoss, false),      kind: "loss" },
    { label: C.AVG_HOLD_ALL,      value: formatDurationMs(s.avgHoldAllMs),  kind: "neutral" },
    { label: C.AVG_HOLD_WIN,      value: formatDurationMs(s.avgHoldWinMs),  kind: "neutral" },
    { label: C.AVG_HOLD_LOSS,     value: formatDurationMs(s.avgHoldLossMs), kind: "neutral" },
    { label: C.AVG_TRADE_PNL,     value: money(s.avgTradePnl),             kind: pnlKind(s.avgTradePnl) },
    { label: C.PROFIT_FACTOR,     value: s.profitFactor.toFixed(2),        kind: s.profitFactor >= 1 ? "profit" : "loss" },
  ]
}

function buildRightColumn(s: OverviewStats): StatItem[] {
  const C = REPORTS.OVERVIEW.STATS
  return [
    { label: C.TRADING_DAYS,         value: s.tradingDays.toString(),        kind: "neutral" },
    { label: C.WINNING_DAYS,         value: s.winningDays.toString(),        kind: "neutral" },
    { label: C.LOSING_DAYS,          value: s.losingDays.toString(),         kind: "neutral" },
    { label: C.MAX_CONSEC_WIN_DAYS,  value: s.maxConsecWinDays.toString(),   kind: "neutral" },
    { label: C.MAX_CONSEC_LOSS_DAYS, value: s.maxConsecLossDays.toString(),  kind: "neutral" },
    { label: C.AVG_DAILY_PNL,        value: money(s.avgDailyPnl),            kind: pnlKind(s.avgDailyPnl) },
    { label: C.AVG_WINNING_DAY,      value: money(s.avgWinningDayPnl),       kind: "profit" },
    { label: C.AVG_LOSING_DAY,       value: money(s.avgLosingDayPnl),        kind: "loss" },
    { label: C.LARGEST_PROFIT_DAY,   value: money(s.largestProfitDay, false),kind: "profit" },
    { label: C.LARGEST_LOSING_DAY,   value: money(s.largestLosingDay, false),kind: "loss" },
    { label: C.TRADE_EXPECTANCY,     value: money(s.tradeExpectancy),        kind: pnlKind(s.tradeExpectancy) },
    { label: C.MAX_DRAWDOWN,         value: money(s.maxDrawdown, false),     kind: "loss" },
    { label: C.AVG_DRAWDOWN,         value: money(s.avgDrawdown, false),     kind: "loss" },
  ]
}

function StatRow({ item }: { item: StatItem }): ReactElement {
  return (
    <div
      style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        padding:        "9px 0",
        borderBottom:   "1px solid var(--color-border)",
        gap:            12,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--color-text-mute)" }}>{item.label}</span>
      <span
        style={{
          fontFamily:         monoFont,
          fontSize:           12.5,
          fontWeight:         500,
          color:              KIND_COLOR[item.kind],
          fontVariantNumeric: "tabular-nums",
          whiteSpace:         "nowrap",
        }}
      >
        {item.value}
      </span>
    </div>
  )
}

function HighlightCell({ label, value, sub, color }: {
  label: string; value: number; sub: string; color: string
}): ReactElement {
  return (
    <div>
      <div
        style={{
          fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
          color: "var(--color-text-mute)", textTransform: "uppercase", marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: monoFont, fontSize: 20, fontWeight: 600, color }}>
        {formatCurrency(value, { sign: false, decimals: 2 })}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-mute)", marginTop: 2 }}>{sub}</div>
    </div>
  )
}

export function OverviewTab({ data }: Props): ReactElement {
  const left  = buildLeftColumn(data.stats)
  const right = buildRightColumn(data.stats)

  const cumData = data.cumPoints.map(p => ({
    label: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
    v:     p.v,
  }))

  const netDailyData = data.netDaily.map(p => {
    const [y, m, d] = p.date.split("-").map(Number)
    const date = new Date(Date.UTC(y!, m! - 1, d!))
    return {
      label: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }),
      v:     p.v,
    }
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Highlights */}
      <div className="card" style={{ padding: 20 }}>
        <div
          style={{
            fontSize: 11, fontWeight: 500, letterSpacing: "0.14em",
            color: "var(--color-text)", textTransform: "uppercase", marginBottom: 4,
          }}
        >
          {REPORTS.OVERVIEW.YOUR_STATS}
        </div>
        <div style={{ display: "flex", gap: 36, marginTop: 14, flexWrap: "wrap" }}>
          <HighlightCell
            label={REPORTS.OVERVIEW.BEST_MONTH}
            value={data.highlights.best.value}
            sub={data.highlights.best.sub}
            color="var(--color-profit)"
          />
          <HighlightCell
            label={REPORTS.OVERVIEW.LOWEST_MONTH}
            value={data.highlights.lowest.value}
            sub={data.highlights.lowest.sub}
            color="var(--color-loss)"
          />
          <HighlightCell
            label={REPORTS.OVERVIEW.AVERAGE}
            value={data.highlights.average.value}
            sub={data.highlights.average.sub}
            color="var(--color-text)"
          />
        </div>
      </div>

      {/* Two stat columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ padding: "4px 16px" }}>
          {left.map((item, i) => <StatRow key={i} item={item} />)}
        </div>
        <div className="card" style={{ padding: "4px 16px" }}>
          {right.map((item, i) => <StatRow key={i} item={item} />)}
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
              color: "var(--color-text-mute)", textTransform: "uppercase", marginBottom: 12,
            }}
          >
            {REPORTS.OVERVIEW.CHART_CUM}
          </div>
          {cumData.length > 0 ? (
            <SignedAreaChart uid="ov-cum" data={cumData} height={230} fewLabels />
          ) : (
            <ChartEmpty />
          )}
        </div>
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
              color: "var(--color-text-mute)", textTransform: "uppercase", marginBottom: 12,
            }}
          >
            {REPORTS.OVERVIEW.CHART_NET_DAILY}
          </div>
          {netDailyData.length > 0 ? (
            <MiniBars data={netDailyData} height={230} mode="signed" />
          ) : (
            <ChartEmpty />
          )}
        </div>
      </div>
    </div>
  )
}

function ChartEmpty(): ReactElement {
  return (
    <div
      style={{
        height: 230, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--color-text-mute)", fontSize: 12,
      }}
    >
      {REPORTS.OVERVIEW.NO_DATA}
    </div>
  )
}
