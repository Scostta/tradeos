import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import type { YearMonth } from "~/lib/finance/year"

const Y = MONEY.YEAR

const COLORS = {
  income:   "var(--color-profit)",
  fixed:    "var(--color-text-mute)",
  variable: "var(--color-long)",
}

function monthShort(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
}

/** "€2.1k", "−€320": etiquetas cortas del gráfico. */
function compact(n: number): string {
  const abs = Math.abs(n)
  const s = abs >= 1000 ? `€${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k` : `€${Math.round(abs)}`
  return n < 0 ? `−${s}` : s
}

// §5.10: ingreso (barra hueca) frente a gasto (fijo + variable) de los 12
// meses, con el ahorro real encima y la tasa de ahorro debajo. Mismo lenguaje
// que el flujo del Overview.
export function MonthsChart({ months }: { months: YearMonth[] }): ReactElement {
  const W = 760, H = 220
  const padL = 40, padR = 6, padT = 22, padB = 38
  const ww = W - padL - padR
  const hh = H - padT - padB

  const max = Math.max(1, ...months.map(m => Math.max(m.income, m.spent)))
  const y = (v: number) => padT + hh - (v / max) * hh
  const gw = ww / 12
  const bw = Math.min(18, gw * 0.3)
  const grid = [0, 0.5, 1].map(f => ({ y: y(max * f), v: max * f }))

  return (
    <div className="flex flex-col gap-2 px-4 py-4 min-w-0">
      <div className="flex items-center justify-end gap-3 text-xs text-text-mute">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm border" style={{ borderColor: COLORS.income }} />{Y.LEGEND_INCOME}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: COLORS.fixed }} />{Y.LEGEND_FIXED}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: COLORS.variable }} />{Y.LEGEND_VARIABLE}</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block", overflow: "visible", minWidth: 560 }}>
          {grid.map((g, i) => (
            <g key={i}>
              <line x1={padL} y1={g.y} x2={W - padR} y2={g.y} stroke="var(--color-border)" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "2 4"} />
              <text x={padL - 6} y={g.y + 3} textAnchor="end" fontSize="9" fill="var(--color-text-mute)" fontFamily="var(--font-mono)">{compact(g.v)}</text>
            </g>
          ))}
          {months.map((m, i) => {
            const cx = padL + gw * i + gw / 2
            const xi = cx - bw - 1.5
            const xs = cx + 1.5
            const top = Math.min(y(m.income), y(m.spent))
            const op = m.partial ? 0.55 : 1
            return (
              <g key={m.month}>
                {m.hasData && (
                  <g opacity={op}>
                    <rect x={xi} y={y(m.income)} width={bw} height={Math.max(0, y(0) - y(m.income))}
                      rx="2" fill={COLORS.income} fillOpacity="0.12" stroke={COLORS.income} strokeOpacity="0.7" strokeWidth="1" />
                    <rect x={xs} y={y(m.fixed)} width={bw} height={Math.max(0, y(0) - y(m.fixed))} rx="2" fill={COLORS.fixed} />
                    <rect x={xs} y={y(m.spent)} width={bw} height={Math.max(0, y(m.fixed) - y(m.spent))} rx="2" fill={COLORS.variable} />
                    <text x={cx} y={top - 7} textAnchor="middle" fontSize="9" fontWeight="600" fontFamily="var(--font-mono)"
                      fill={m.realSavings >= 0 ? "var(--color-profit)" : "var(--color-loss)"}>
                      {m.realSavings >= 0 ? "+" : ""}{compact(m.realSavings)}
                    </text>
                  </g>
                )}
                <text x={cx} y={H - 22} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)"
                  fill={m.hasData ? "var(--color-text)" : "var(--color-text-mute)"}>
                  {monthShort(m.month)}
                </text>
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)"
                  fill={m.rate == null ? "var(--color-text-mute)" : m.rate >= 0 ? "var(--color-profit)" : "var(--color-loss)"}>
                  {!m.hasData ? "·" : m.partial ? Y.IN_PROGRESS : m.rate == null ? "—" : `${Math.round(m.rate * 100)}%`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
