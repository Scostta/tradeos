import type { ReactElement, ReactNode } from "react"
import { INVEST } from "~/constants/copies/invest"
import { testMonth } from "~/lib/calculations/invest-performance"
import type { PerformanceReport } from "~/lib/calculations/invest-performance"
import { HORIZON_MONTHS } from "~/types/invest"
import type { ExitReason, InvestPositionWithMeta, InvestSettings } from "~/types/invest"
import { TriangleAlertIcon } from "~/lib/ui/icons/triangle-alert-icon"
import { cn } from "~/utils/cn"
import { fmtDay, fmtPct, signColor } from "../../components/invest-format"
import { GrowthChart } from "./growth-chart.client"

const P = INVEST.PERFORMANCE
const EXIT_REASONS: ExitReason[] = ["sma_exit", "falsifier", "manual"]

// Vista pura de la pestaña Performance: los datos ya calculados entran por props.
function Tile({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }): ReactElement {
  return (
    <div className="card flex flex-col gap-2 px-4 py-3.5 min-w-0">
      <span className="label-caps">{label}</span>
      <div className="flex items-baseline gap-2">{children}</div>
      {sub && <div className="text-sm text-text-mute">{sub}</div>}
    </div>
  )
}

function shortMonth(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
}

export function PerformanceView({ settings, positions, report, reviews, today }: {
  settings:  InvestSettings
  positions: InvestPositionWithMeta[]
  report:    PerformanceReport | null
  reviews:   { reviewed: number; total: number }
  today:     string
}): ReactElement {
  const month = testMonth(settings.startedAt, today)
  const exits = Object.fromEntries(
    EXIT_REASONS.map(r => [r, positions.filter(p => p.exitReason === r).length]),
  ) as Record<ExitReason, number>
  const hasData = report != null && report.months > 0
  const since = P.SINCE.replace("{date}", fmtDay(settings.startedAt))

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Tile
          label={P.MONTH}
          sub={
            <div className="flex flex-col gap-1.5">
              <span>{P.STARTED.replace("{date}", fmtDay(settings.startedAt))}</span>
              <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={cn("h-full rounded-full", month > HORIZON_MONTHS ? "bg-short" : "bg-accent")}
                  style={{ width: `${Math.min(month / HORIZON_MONTHS, 1) * 100}%` }}
                />
              </div>
            </div>
          }
        >
          <span className="mono text-2xl font-semibold tracking-tight text-text">{month}</span>
          <span className="mono text-md text-text-mute">/ {HORIZON_MONTHS}</span>
        </Tile>
        <Tile label={P.SATELLITE_NET} sub={since}>
          <span className={cn("mono text-2xl font-semibold tracking-tight", signColor(hasData ? report.satellite.netTax : null))}>
            {hasData ? fmtPct(report.satellite.netTax, { sign: true, decimals: 2 }) : "—"}
          </span>
        </Tile>
        <Tile label={`${P.BENCHMARK} · ${settings.benchmarkTicker}`} sub={since}>
          <span className={cn("mono text-2xl font-semibold tracking-tight", signColor(hasData ? report.benchmark : null))}>
            {hasData ? fmtPct(report.benchmark, { sign: true, decimals: 2 }) : "—"}
          </span>
        </Tile>
        <Tile
          label={P.DIFFERENCE}
          sub={hasData ? (report.diff >= 0 ? P.AHEAD : P.BEHIND) : P.NO_DATA_YET}
        >
          <span className={cn("mono text-2xl font-semibold tracking-tight", signColor(hasData ? report.diff : null))}>
            {hasData ? fmtPct(report.diff, { sign: true, decimals: 2 }) : "—"}
          </span>
        </Tile>
      </div>

      {month > HORIZON_MONTHS && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-short/30 bg-short/10 text-short text-sm">
          <TriangleAlertIcon />
          {P.EVALUATION_DUE}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 border-b border-border">
          <span className="text-md font-semibold text-text">{P.CHART_TITLE}</span>
          <span className="flex items-center gap-1.5 text-sm text-text-dim">
            <span className="size-2 rounded-full bg-accent" />{P.LEGEND_SAT}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-text-dim">
            <span className="size-2 rounded-full bg-long" />{settings.benchmarkTicker}
          </span>
        </div>
        <div className="px-2 py-3">
          {report && report.points.length > 1 ? (
            <GrowthChart
              data={report.points.map(p => ({ label: shortMonth(p.monthEnd), satellite: p.satellite, benchmark: p.benchmark }))}
              labels={{ satellite: P.SATELLITE_NET, benchmark: settings.benchmarkTicker }}
            />
          ) : (
            <div className="py-16 text-center text-sm text-text-mute">{P.NO_DATA_YET}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border">
            <span className="text-md font-semibold text-text">{P.RETURNS_TITLE}</span>
            {hasData && <span className="mono text-xs text-text-mute">{P.PERIOD.replace("{n}", String(report.months))}</span>}
          </div>
          <dl className="flex flex-col py-1">
            {([
              [P.ROWS.GROSS,     hasData ? report.satellite.gross : null,   false],
              [P.ROWS.NET_FEES,  hasData ? report.satellite.netFees : null, false],
              [P.ROWS.NET_TAX,   hasData ? report.satellite.netTax : null,  true],
              [P.ROWS.BENCHMARK, hasData ? report.benchmark : null,         true],
              [P.ROWS.DIFF,      hasData ? report.diff : null,              true],
            ] as const).map(([label, value, strong], i) => (
              <div key={label} className={cn("flex items-center justify-between gap-3 px-4 py-2", i === 4 && "border-t border-border mt-1 pt-3")}>
                <dt className={cn("text-sm", strong ? "text-text" : "text-text-dim")}>{label}</dt>
                <dd className={cn("mono text-md", signColor(value), strong && "font-semibold")}>
                  {fmtPct(value, { sign: true, decimals: 2 })}
                </dd>
              </div>
            ))}
          </dl>
          <div className="px-4 py-2.5 border-t border-border text-xs text-text-mute">{P.TOTAL_RETURN_NOTE}</div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border">
            <span className="text-md font-semibold text-text">{P.ACTIVITY_TITLE}</span>
          </div>
          <dl className="flex flex-col py-1">
            <div className="flex items-center justify-between gap-3 px-4 py-2">
              <dt className="text-sm text-text-dim">{P.TRADES}</dt>
              <dd className="mono text-md text-text">{positions.length}</dd>
            </div>
            <div className="flex items-start justify-between gap-3 px-4 py-2">
              <dt className="text-sm text-text-dim">{P.EXITS}</dt>
              <dd className="flex flex-wrap justify-end gap-1.5">
                {EXIT_REASONS.map(r => (
                  <span
                    key={r}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-sm",
                      r === "manual" && exits[r] > 0 ? "bg-short/10 text-short" : "bg-surface-2 text-text-dim",
                    )}
                  >
                    {INVEST.POSITIONS.REASONS[r]}
                    <span className="mono text-text">{exits[r]}</span>
                  </span>
                ))}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2">
              <dt className="text-sm text-text-dim">{P.REVIEWED}</dt>
              <dd className="flex items-baseline gap-2">
                <span className="mono text-md text-text">
                  {reviews.total > 0 ? fmtPct(reviews.reviewed / reviews.total, { decimals: 0 }) : "—"}
                </span>
                <span className="mono text-xs text-text-mute">
                  {P.REVIEWED_OF.replace("{reviewed}", String(reviews.reviewed)).replace("{total}", String(reviews.total))}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </>
  )
}

