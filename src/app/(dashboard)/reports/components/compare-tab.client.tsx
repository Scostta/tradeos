"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import type { CompareData, ComparePeriod } from "~/types/reports"
import { COMPARE_PERIOD_OPTIONS } from "~/helpers/compare-period"
import type { ComparePeriodKey } from "~/helpers/compare-period"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency, formatPct, formatCompactCurrency, formatDurationMs } from "~/helpers/format"
import { compareReportsPeriods } from "~/actions/reports"

type Props = {
  initial:   CompareData
  accountId: string | null
}

type MetricKind = "currency" | "pct" | "ratio" | "int" | "duration"

type MetricDef = {
  label:     string
  pick:      (p: ComparePeriod) => number
  kind:      MetricKind
  showDelta: boolean
}

const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"
const ACCENT_A = "var(--color-accent)"
const ACCENT_B = "var(--color-long)"

const METRICS: MetricDef[] = [
  { label: REPORTS.COMPARE.METRICS.NET_PNL,          pick: p => p.net,             kind: "currency", showDelta: true },
  { label: REPORTS.COMPARE.METRICS.TRADES,           pick: p => p.trades,          kind: "int",      showDelta: true },
  { label: REPORTS.COMPARE.METRICS.WIN_RATE,         pick: p => p.winRate,         kind: "pct",      showDelta: true },
  { label: REPORTS.COMPARE.METRICS.PROFIT_FACTOR,    pick: p => p.profitFactor,    kind: "ratio",    showDelta: true },
  { label: REPORTS.COMPARE.METRICS.AVG_DAILY_PNL,    pick: p => p.avgDailyNetPnl,  kind: "currency", showDelta: true },
  { label: REPORTS.COMPARE.METRICS.MAX_DRAWDOWN,     pick: p => p.maxDrawdown,     kind: "currency", showDelta: true },
  { label: REPORTS.COMPARE.METRICS.TRADE_EXPECTANCY, pick: p => p.tradeExpectancy, kind: "currency", showDelta: true },
  { label: REPORTS.COMPARE.METRICS.AVG_HOLD_TIME,    pick: p => p.avgHoldTimeMs,   kind: "duration", showDelta: false },
]

function fmtValue(kind: MetricKind, v: number): string {
  switch (kind) {
    case "currency": return formatCurrency(v, { sign: true, decimals: 2 })
    case "pct":      return formatPct(v)
    case "ratio":    return v.toFixed(2)
    case "int":      return v.toString()
    case "duration": return formatDurationMs(v)
  }
}

function fmtDelta(kind: MetricKind, absDelta: number): string {
  switch (kind) {
    case "currency": return formatCompactCurrency(absDelta)
    case "pct":      return formatPct(absDelta)
    case "ratio":    return absDelta.toFixed(2)
    case "int":      return Math.round(absDelta).toString()
    case "duration": return ""
  }
}

const isMoney = (kind: MetricKind): boolean => kind === "currency"

function valueColor(kind: MetricKind, v: number): string {
  if (!isMoney(kind)) return "var(--color-text)"
  return v >= 0 ? "var(--color-profit)" : "var(--color-loss)"
}

function PeriodCard({ period, accent }: { period: ComparePeriod; accent: string }): ReactElement {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: accent }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{period.label}</span>
        </div>
        <span style={{ fontSize: 11, color: "var(--color-text-mute)", fontFamily: monoFont, marginLeft: 2 }}>
          {period.sub}
        </span>
      </div>

      <div
        style={{
          fontFamily:    monoFont,
          fontSize:      30,
          fontWeight:    600,
          color:         period.net >= 0 ? "var(--color-profit)" : "var(--color-loss)",
          letterSpacing: "-0.02em",
        }}
      >
        {formatCurrency(period.net, { sign: true, decimals: 0 })}
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        <CardStat label={REPORTS.COMPARE.CARD.TRADES} value={period.trades.toString()} />
        <CardStat label={REPORTS.COMPARE.CARD.WIN_RATE} value={formatPct(period.winRate)} color={ACCENT_A} />
        <CardStat label={REPORTS.COMPARE.CARD.PF} value={period.profitFactor.toFixed(2)} />
      </div>
    </div>
  )
}

function CardStat({ label, value, color }: { label: string; value: string; color?: string }): ReactElement {
  return (
    <div>
      <div
        style={{
          fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
          color: "var(--color-text-mute)", textTransform: "uppercase", marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: monoFont, fontSize: 15, fontWeight: 700,
          color: color ?? "var(--color-text)", fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function PeriodSelect({ value, accent, onChange, disabled }: {
  value: ComparePeriodKey; accent: string; onChange: (k: ComparePeriodKey) => void; disabled: boolean
}): ReactElement {
  return (
    <label
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 9px",
        background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 6,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 3, background: accent }} />
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value as ComparePeriodKey)}
        style={{
          background: "transparent", border: "none", color: "var(--color-text)",
          fontFamily: "inherit", fontSize: 12, cursor: disabled ? "default" : "pointer", outline: "none",
        }}
      >
        {COMPARE_PERIOD_OPTIONS.map(o => (
          <option key={o.id} value={o.id} style={{ background: "var(--color-surface)" }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CompareTab({ initial, accountId }: Props): ReactElement {
  const [data, setData]   = useState<CompareData>(initial)
  const [keyA, setKeyA]   = useState<ComparePeriodKey>(initial.a.key)
  const [keyB, setKeyB]   = useState<ComparePeriodKey>(initial.b.key)
  const [pending, start]  = useTransition()

  function run(nextA: ComparePeriodKey, nextB: ComparePeriodKey): void {
    start(async () => {
      const result = await compareReportsPeriods({ accountId, keyA: nextA, keyB: nextB })
      if (result.success) setData(result.data)
    })
  }

  function changeA(k: ComparePeriodKey): void { setKeyA(k); run(k, keyB) }
  function changeB(k: ComparePeriodKey): void { setKeyB(k); run(keyA, k) }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: pending ? 0.6 : 1, transition: "opacity .15s" }}>
      {/* Period selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PeriodSelect value={keyA} accent={ACCENT_A} onChange={changeA} disabled={pending} />
        <PeriodSelect value={keyB} accent={ACCENT_B} onChange={changeB} disabled={pending} />
      </div>

      {/* Period cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PeriodCard period={data.a} accent={ACCENT_A} />
        <PeriodCard period={data.b} accent={ACCENT_B} />
      </div>

      {/* Head-to-head table */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: "12px 16px", borderBottom: "1px solid var(--color-border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
              color: "var(--color-text-mute)", textTransform: "uppercase",
            }}
          >
            {REPORTS.COMPARE.HEAD_TO_HEAD}
          </div>
          {pending && (
            <span style={{ fontSize: 11, color: "var(--color-text-mute)" }}>{REPORTS.COMPARE.LOADING}</span>
          )}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[REPORTS.COMPARE.COL_METRIC, data.a.label, data.b.label, REPORTS.COMPARE.COL_DELTA].map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: "10px 16px", fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: "var(--color-text-mute)",
                    borderBottom: "1px solid var(--color-border)", textAlign: i === 0 ? "left" : "right",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m, i) => {
              const av    = m.pick(data.a)
              const bv    = m.pick(data.b)
              const delta = av - bv
              const better = delta > 0 // higher is better for every shown metric (drawdown is negative)
              return (
                <tr key={i} style={{ height: 44 }}>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", fontSize: 12.5, color: "var(--color-text-mute)" }}>
                    {m.label}
                  </td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                    <span style={{ fontFamily: monoFont, fontSize: 12.5, fontWeight: 700, color: valueColor(m.kind, av), fontVariantNumeric: "tabular-nums" }}>
                      {fmtValue(m.kind, av)}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                    <span style={{ fontFamily: monoFont, fontSize: 12.5, color: isMoney(m.kind) ? valueColor(m.kind, bv) : "var(--color-text-mute)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtValue(m.kind, bv)}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                    {m.showDelta ? (
                      <span style={{ fontFamily: monoFont, fontSize: 12, color: better ? "var(--color-profit)" : "var(--color-loss)", fontVariantNumeric: "tabular-nums" }}>
                        {better ? "▲" : "▼"} {fmtDelta(m.kind, Math.abs(delta))}
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-mute)" }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
