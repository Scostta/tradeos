import type { ReactElement, ReactNode } from "react"
import { INVEST } from "~/constants/copies/invest"
import { CircleCheckIcon } from "~/lib/ui/icons/circle-check-icon"
import { CircleXIcon } from "~/lib/ui/icons/circle-x-icon"
import type { FailReason, ScreenResult } from "~/types/invest"
import { cn } from "~/utils/cn"
import { fmtInt, fmtMarketCap, fmtMultiple, fmtPct, fmtPrice } from "./invest-format"

const S = INVEST.SCREEN
const M = S.METRICS
const T = S.THRESHOLDS

// Una fila por regla de §1. Pasa o falla según los fail_reasons que guardó el
// job: aquí no se recalcula nada, solo se muestra el valor y el umbral.
type Rule = {
  reason:    FailReason
  label:     string
  value:     string
  threshold: string
}

function groups(r: ScreenResult, benchmark: string): { title: string; rules: Rule[] }[] {
  return [
    {
      title: S.GROUPS.UNIVERSE,
      rules: [
        { reason: "market_cap",    label: M.MARKET_CAP,    value: fmtMarketCap(r.marketCap), threshold: T.MARKET_CAP },
        { reason: "months_listed", label: M.MONTHS_LISTED, value: fmtInt(r.monthsListed),    threshold: T.MONTHS_LISTED },
      ],
    },
    {
      title: S.GROUPS.FUNDAMENTAL,
      rules: [
        { reason: "revenue_growth",  label: M.GROWTH,       value: fmtPct(r.revenueGrowthYoy),   threshold: T.GROWTH },
        { reason: "fcf_margin",      label: M.FCF,          value: fmtPct(r.fcfMargin),          threshold: T.FCF },
        {
          reason: "gross_margin", label: M.GROSS_MARGIN, threshold: T.GROSS_MARGIN,
          value: `${fmtPct(r.grossMargin)} / ${fmtPct(r.grossMarginPrev)}`,
        },
        { reason: "net_debt_ebitda", label: M.ND_EBITDA,    value: fmtMultiple(r.netDebtEbitda), threshold: T.ND_EBITDA },
        { reason: "roic",            label: M.ROIC,         value: fmtPct(r.roic),               threshold: T.ROIC },
      ],
    },
    {
      title: S.GROUPS.TECHNICAL,
      rules: [
        {
          reason: "sma10m", label: M.PRICE_SMA, threshold: T.SMA,
          value: `${fmtPrice(r.price, null)} / ${fmtPrice(r.sma10m, null)}`,
        },
        { reason: "momentum_12_1",   label: M.MOMENTUM, value: fmtPct(r.momentum121, { sign: true }),   threshold: T.MOMENTUM },
        {
          reason: "rel_strength_6m", label: M.RS, value: fmtPct(r.relStrength6m, { sign: true }),
          threshold: T.RS.replace("{benchmark}", benchmark),
        },
      ],
    },
  ]
}

function Chip({ children }: { children: ReactNode }): ReactElement {
  return <span className="mono text-xs px-2 py-0.5 rounded-sm bg-surface-2 text-text-dim">{children}</span>
}

export function TickerDetail({ result: r, benchmark }: { result: ScreenResult; benchmark: string }): ReactElement {
  const failed = new Set(r.failReasons)
  const noData = failed.has("no_data")

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Cabecera: ticker, nombre, datos y veredicto */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="min-w-0 flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="mono text-2xl font-semibold tracking-tight text-text">{r.ticker}</span>
            <span className="text-md text-text-dim truncate">{r.name ?? ""}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {r.exchange && <Chip>{r.exchange}</Chip>}
            <Chip>{r.sector ?? S.NO_SECTOR}</Chip>
            {r.currency && <Chip>{r.currency}</Chip>}
          </div>
        </div>
        <div className="md:ml-auto">
          {r.passes ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-profit/10 text-profit text-md font-medium">
              <CircleCheckIcon /> {S.SEARCH_PASSES}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-loss/10 text-loss text-md font-medium">
              <CircleXIcon /> {noData ? INVEST.FAIL_REASONS.no_data : S.SEARCH_FAILS.replace("{count}", String(r.failReasons.length))}
            </span>
          )}
        </div>
      </div>

      {noData ? (
        <div className="text-sm text-text-mute">{S.NO_DATA}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {groups(r, benchmark).map(g => {
            const passed = g.rules.filter(rule => !failed.has(rule.reason)).length
            const allPass = passed === g.rules.length
            return (
              <div key={g.title} className="rounded-md border border-border bg-bg">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="label-caps">{g.title}</span>
                  <span className={cn("mono text-xs", allPass ? "text-profit" : "text-loss")}>
                    {S.RULES_PASSED.replace("{passed}", String(passed)).replace("{total}", String(g.rules.length))}
                  </span>
                </div>
                <ul className="flex flex-col py-1">
                  {g.rules.map(rule => {
                    const bad = failed.has(rule.reason)
                    return (
                      <li key={rule.label} className="flex items-start gap-2.5 px-3 py-2">
                        <span className={cn("mt-px", bad ? "text-loss" : "text-profit")}>
                          {bad ? <CircleXIcon /> : <CircleCheckIcon />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className={cn("text-sm", bad ? "text-text" : "text-text-dim")}>{rule.label}</span>
                            <span
                              className={cn("mono text-sm whitespace-nowrap", bad ? "text-loss" : "text-text")}
                              title={bad && rule.value === "—" ? INVEST.NOT_COMPUTABLE : undefined}
                            >
                              {rule.value}
                            </span>
                          </div>
                          <div className="mono text-xs text-text-mute">{rule.threshold}</div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
