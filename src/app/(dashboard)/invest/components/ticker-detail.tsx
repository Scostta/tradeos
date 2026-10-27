import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import type { FailReason, ScreenResult } from "~/types/invest"
import { cn } from "~/utils/cn"
import { fmtInt, fmtMarketCap, fmtMultiple, fmtPct, fmtPrice } from "./invest-format"

const M = INVEST.SCREEN.METRICS

type Metric = {
  label:  string
  value:  string
  reason: FailReason   // la regla que lo evalúa (el job decide; aquí solo se marca)
}

function groups(r: ScreenResult): { title: string; metrics: Metric[] }[] {
  return [
    {
      title: INVEST.SCREEN.GROUPS.UNIVERSE,
      metrics: [
        { label: M.MARKET_CAP,    value: fmtMarketCap(r.marketCap),   reason: "market_cap" },
        { label: M.MONTHS_LISTED, value: fmtInt(r.monthsListed),      reason: "months_listed" },
      ],
    },
    {
      title: INVEST.SCREEN.GROUPS.FUNDAMENTAL,
      metrics: [
        { label: M.GROWTH,       value: fmtPct(r.revenueGrowthYoy),   reason: "revenue_growth" },
        { label: M.FCF,          value: fmtPct(r.fcfMargin),          reason: "fcf_margin" },
        { label: M.GROSS_MARGIN, value: fmtPct(r.grossMargin),        reason: "gross_margin" },
        { label: M.GROSS_PREV,   value: fmtPct(r.grossMarginPrev),    reason: "gross_margin" },
        { label: M.ND_EBITDA,    value: fmtMultiple(r.netDebtEbitda), reason: "net_debt_ebitda" },
        { label: M.ROIC,         value: fmtPct(r.roic),               reason: "roic" },
      ],
    },
    {
      title: INVEST.SCREEN.GROUPS.TECHNICAL,
      metrics: [
        { label: M.PRICE,    value: fmtPrice(r.price, r.currency),             reason: "sma10m" },
        { label: M.SMA10,    value: fmtPrice(r.sma10m, r.currency),            reason: "sma10m" },
        { label: M.MOMENTUM, value: fmtPct(r.momentum121, { sign: true }),     reason: "momentum_12_1" },
        { label: M.RS,       value: fmtPct(r.relStrength6m, { sign: true }),   reason: "rel_strength_6m" },
      ],
    },
  ]
}

export function TickerDetail({ result: r }: { result: ScreenResult }): ReactElement {
  const failed = new Set(r.failReasons)
  const noData = failed.has("no_data")

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex flex-col md:flex-row md:items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="mono text-2xl font-semibold text-text">{r.ticker}</span>
            <span className="text-md text-text-dim truncate">{r.name ?? ""}</span>
          </div>
          <div className="text-sm text-text-mute mt-0.5">
            {[r.exchange, r.sector ?? INVEST.SCREEN.NO_SECTOR, r.currency].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="md:ml-auto flex flex-wrap gap-1.5 md:justify-end">
          {r.passes ? (
            <span className="mono text-xs px-2 py-1 rounded-sm bg-surface-2 text-profit">
              {INVEST.SCREEN.SEARCH_PASSES}
            </span>
          ) : (
            r.failReasons.map(reason => (
              <span key={reason} className="text-xs px-2 py-1 rounded-sm bg-surface-2 text-loss">
                {INVEST.FAIL_REASONS[reason]}
              </span>
            ))
          )}
        </div>
      </div>

      {!noData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {groups(r).map(g => (
            <div key={g.title} className="rounded-md border border-border">
              <div className="label-caps px-3 py-2 border-b border-border">{g.title}</div>
              <dl className="flex flex-col">
                {g.metrics.map(m => {
                  const bad = failed.has(m.reason)
                  return (
                    <div key={m.label} className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <dt className={cn("text-sm", bad ? "text-loss" : "text-text-mute")}>{m.label}</dt>
                      <dd
                        className={cn("mono text-sm whitespace-nowrap", bad ? "text-loss" : "text-text")}
                        title={bad && m.value === "—" ? INVEST.NOT_COMPUTABLE : undefined}
                      >
                        {m.value}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
