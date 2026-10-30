import type { ReactElement } from "react"
import type { BeReport } from "~/lib/calculations/be-analysis"
import { REPORTS } from "~/constants/copies/reports"
import { formatCompactCurrency, formatPct } from "~/helpers/format"

const C = REPORTS.BE.EVOLUTION
const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"
const MAX_LABELS = 12

// Las claves ya están en la zona del usuario (domingo YYYY-MM-DD o YYYY-MM): se formatean en UTC.
function periodLabel(key: string, unit: "week" | "month"): string {
  const d = new Date(unit === "week" ? `${key}T00:00:00Z` : `${key}-01T00:00:00Z`)
  return unit === "week"
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    : d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
}

// % de BE por semana (o mes) y lo devuelto a 1R acumulado, con el mismo eje de tiempo.
export function BeEvolutionCard({ evolution }: { evolution: BeReport["evolution"] }): ReactElement {
  const { unit, periods } = evolution
  const W = 960, padL = 8, padR = 8
  const step  = (W - padL - padR) / Math.max(1, periods.length)
  const every = Math.ceil(periods.length / MAX_LABELS)
  const cx    = (i: number): number => padL + step * i + step / 2

  // Barras de tasa
  const BH = 150, bTop = 18, bBottom = 24
  const bh = BH - bTop - bBottom
  const bw = Math.min(40, step * 0.62)

  // Línea de devuelto acumulado
  const lastCum = periods[periods.length - 1]?.cumMissed ?? 0
  const LH = 70, lTop = 16, lBottom = 10
  const ly = (v: number): number => LH - lBottom - (v / Math.max(1, lastCum)) * (LH - lTop - lBottom)
  const path = periods.map((p, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${ly(p.cumMissed).toFixed(1)}`).join(" ")

  return (
    <div className="card p-0">
      <div className="px-4 py-3 border-b border-border">
        <span className="label-caps">{unit === "week" ? C.TITLE_WEEK : C.TITLE_MONTH}</span>
      </div>
      <div className="px-4 py-3">
        <svg viewBox={`0 0 ${W} ${BH}`} width="100%" style={{ display: "block" }}>
          <line x1={padL} x2={W - padR} y1={BH - bBottom} y2={BH - bBottom} stroke="var(--color-border-hi)" strokeWidth="1" />
          {periods.map((p, i) => {
            const h = (p.rate ?? 0) * bh   // escala fija 0–100 %
            return (
              <g key={p.key}>
                {p.rate != null && (
                  <>
                    <rect x={cx(i) - bw / 2} y={BH - bBottom - h} width={bw} height={Math.max(1, h)} rx="2" fill="var(--color-short)" opacity="0.85" />
                    {step >= 28 && (
                      <text x={cx(i)} y={BH - bBottom - h - 5} textAnchor="middle" fontSize="9.5" fontFamily={monoFont} fill="var(--color-text-dim)">
                        {formatPct(p.rate, 0)}
                      </text>
                    )}
                  </>
                )}
                {i % every === 0 && (
                  <text x={cx(i)} y={BH - 7} textAnchor="middle" fontSize="9.5" fontFamily={monoFont} fill="var(--color-text-mute)">
                    {periodLabel(p.key, unit)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {lastCum > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="label-caps">{C.CUM_MISSED}</span>
            <span className="mono text-xs text-short ml-auto">{formatCompactCurrency(lastCum)}</span>
          </div>
          <svg viewBox={`0 0 ${W} ${LH}`} width="100%" style={{ display: "block" }}>
            <line x1={padL} x2={W - padR} y1={ly(0)} y2={ly(0)} stroke="var(--color-border)" strokeWidth="1" />
            <path d={path} fill="none" stroke="var(--color-short)" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  )
}
