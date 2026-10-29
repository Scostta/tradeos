import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import type { FundamentalsRow } from "~/lib/calculations/invest-detail"
import { cn } from "~/utils/cn"
import { fmtMultiple, fmtPct } from "../../components/invest-format"

const D = INVEST.DETAIL

function compact(n: number | null): string {
  if (n == null) return "—"
  const a = Math.abs(n)
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(0)}M` : a.toLocaleString("en-US")
  return n < 0 ? `−${s}` : s
}

type Metric = { label: string; values: (number | null)[]; fmt: (n: number | null) => string; lowerIsBetter?: boolean }

// §4.7: los 4 años fiscales como mini-gráficos de barras (del más antiguo al
// más reciente, el último en el color de acento; los negativos en rojo salvo
// deuda neta/EBITDA, donde negativo es caja neta) con la
// tendencia contra el año anterior.
export function FundamentalsCharts({ rows }: { rows: FundamentalsRow[] }): ReactElement {
  const years = [...rows].sort((a, b) => a.fiscalYear - b.fiscalYear)
  const metrics: Metric[] = [
    { label: D.HEADERS.REVENUE, values: years.map(y => y.revenue), fmt: compact },
    { label: D.HEADERS.GROSS, values: years.map(y => y.grossMargin), fmt: n => fmtPct(n) },
    { label: D.HEADERS.FCF, values: years.map(y => y.fcf), fmt: compact },
    { label: D.HEADERS.ROIC, values: years.map(y => y.roic), fmt: n => fmtPct(n) },
    { label: D.HEADERS.ND_EBITDA, values: years.map(y => y.netDebtEbitda), fmt: n => fmtMultiple(n), lowerIsBetter: true },
  ]

  return (
    <div className="grid gap-px bg-border" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
      {metrics.map(m => {
        const max = Math.max(...m.values.map(v => Math.abs(v ?? 0)), 0) || 1
        const last = m.values.at(-1) ?? null
        const prev = m.values.at(-2) ?? null
        const better = last != null && prev != null ? (m.lowerIsBetter ? last < prev : last > prev) : null
        return (
          <div key={m.label} className="bg-surface px-4 py-3.5 flex flex-col gap-2.5 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-text-dim">{m.label}</span>
              <span className="mono text-md font-semibold text-text">{m.fmt(last)}</span>
            </div>
            <div className="flex items-end gap-1.5 h-16" role="img" aria-label={`${m.label}: ${years.map((y, i) => `FY${y.fiscalYear} ${m.fmt(m.values[i] ?? null)}`).join(", ")}`}>
              {m.values.map((v, i) => (
                <span key={years[i]!.fiscalYear} className="flex-1 flex flex-col justify-end h-full" title={`FY${years[i]!.fiscalYear} · ${m.fmt(v)}`}>
                  <span
                    className={cn("block rounded-t-sm", v != null && v < 0 && !m.lowerIsBetter ? "bg-loss" : i === m.values.length - 1 ? "bg-accent" : "bg-border-hi")}
                    style={{ height: `${Math.max(4, (Math.abs(v ?? 0) / max) * 100)}%` }}
                  />
                </span>
              ))}
            </div>
            <div className="flex gap-1.5 mono text-xs text-text-mute">
              {years.map(y => <span key={y.fiscalYear} className="flex-1 text-center">{String(y.fiscalYear).slice(2)}</span>)}
            </div>
            {better != null && (
              <span className={cn("text-xs", better ? "text-profit" : "text-short")}>
                {(better ? D.IMPROVING : D.WEAKENING).replace("{year}", String(years.at(-2)!.fiscalYear))}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
