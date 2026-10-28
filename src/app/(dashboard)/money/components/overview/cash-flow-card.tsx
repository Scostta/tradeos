import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import { cn } from "~/utils/cn"
import { fmtEur } from "../money-format"
import type { FlowMonth } from "./overview-data"

const O = MONEY.OVERVIEW

const COLORS = {
  fixed:    "var(--color-text-mute)",
  variable: "var(--color-long)",
  saved:    "var(--color-accent)",
  over:     "var(--color-loss)",
  income:   "var(--color-profit)",
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

const pct = (n: number) => `${Math.round(n * 100)}%`

// ── Este mes: a dónde fue el ingreso ─────────────────────────────────────────

function Allocation({ m }: { m: FlowMonth }): ReactElement {
  const spent = m.fixed + m.variable
  const saved = Math.max(0, m.income - spent)
  const over = Math.max(0, spent - m.income)
  const total = Math.max(m.income, spent, 1)
  const rate = m.income > 0 ? m.realSavings / m.income : null

  const segments = [
    { key: "fixed", label: O.FIXED, value: m.fixed, color: COLORS.fixed },
    { key: "variable", label: O.VARIABLE, value: m.variable, color: COLORS.variable },
    saved > 0
      ? { key: "saved", label: O.SAVED, value: saved, color: COLORS.saved }
      : { key: "over", label: O.OVER_INCOME, value: over, color: COLORS.over },
  ].filter(s => s.value > 0)

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div>
        <div className="label-caps">{O.THIS_MONTH}</div>
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className={cn("mono text-4xl font-semibold tracking-tight leading-none", rate == null ? "text-text-mute" : rate >= 0 ? "text-profit" : "text-loss")}>
            {rate == null ? "—" : pct(rate)}
          </span>
          <span className="text-sm text-text-mute">{O.OF_INCOME_SAVED}</span>
        </div>
      </div>

      <div className="flex h-2.5 gap-0.5 rounded-full overflow-hidden bg-surface-2">
        {segments.map(s => (
          <div key={s.key} style={{ flex: s.value / total, background: s.color }} />
        ))}
        {total > spent + saved && <div style={{ flex: (total - spent - saved) / total }} />}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full shrink-0 border" style={{ borderColor: COLORS.income }} />
          <span className="text-text-dim flex-1">{O.INCOME}</span>
          <span className="mono text-text font-semibold">{fmtEur(m.income, { decimals: 0 })}</span>
          <span className="mono text-xs text-text-mute text-right" style={{ width: 40 }}>100%</span>
        </div>
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            <span className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-text-dim flex-1">{s.label}</span>
            <span className={cn("mono", s.key === "over" ? "text-loss" : s.key === "saved" ? "text-profit" : "text-text")}>
              {fmtEur(s.key === "over" ? -s.value : s.value, { decimals: 0 })}
            </span>
            <span className="mono text-xs text-text-mute text-right" style={{ width: 40 }}>
              {m.income > 0 ? pct(s.value / m.income) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Últimos meses: ingreso frente a gasto ────────────────────────────────────

function History({ months, selected }: { months: FlowMonth[]; selected: string }): ReactElement {
  const W = 420, H = 176
  const padL = 40, padR = 6, padT = 22, padB = 22
  const ww = W - padL - padR
  const hh = H - padT - padB

  const max = Math.max(1, ...months.map(m => Math.max(m.income, m.fixed + m.variable)))
  const y = (v: number) => padT + hh - (v / max) * hh
  const gw = ww / Math.max(months.length, 1)
  const bw = Math.min(22, gw * 0.3)
  const grid = [0, 0.5, 1].map(f => ({ y: y(max * f), v: max * f }))
  const animKey = months.map(m => `${m.month}:${m.income}:${m.fixed}:${m.variable}`).join("|")

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{O.LAST_MONTHS.replace("{n}", String(months.length))}</span>
        <span className="flex items-center gap-3 text-xs text-text-mute">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm border" style={{ borderColor: COLORS.income }} />{O.INCOME}</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: COLORS.variable }} />{O.SPENT_LEGEND}</span>
        </span>
      </div>
      <style>{`
        @keyframes flowBarUp { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .flow-bar { transform-box: fill-box; transform-origin: 50% 100%; animation: flowBarUp .55s cubic-bezier(.34,1.56,.64,1) both; }
      `}</style>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block", overflow: "visible" }}>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={padL} y1={g.y} x2={W - padR} y2={g.y} stroke="var(--color-border)" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "2 4"} />
            <text x={padL - 6} y={g.y + 3} textAnchor="end" fontSize="9" fill="var(--color-text-mute)" fontFamily="var(--font-mono)">{compact(g.v)}</text>
          </g>
        ))}
        <g key={animKey}>
          {months.map((m, i) => {
            const cx = padL + gw * i + gw / 2
            const on = m.month === selected
            const op = on ? 1 : 0.5
            const xi = cx - bw - 1.5
            const xs = cx + 1.5
            const delay = `${i * 60}ms`
            const top = Math.min(y(m.income), y(m.fixed + m.variable))
            return (
              <g key={m.month} opacity={op}>
                {/* Ingreso: barra hueca */}
                <rect className="flow-bar" style={{ animationDelay: delay }} x={xi} y={y(m.income)} width={bw} height={Math.max(0, y(0) - y(m.income))}
                  rx="2" fill={COLORS.income} fillOpacity="0.12" stroke={COLORS.income} strokeOpacity="0.7" strokeWidth="1" />
                {/* Gasto: fijo abajo, variable encima */}
                <rect className="flow-bar" style={{ animationDelay: delay }} x={xs} y={y(m.fixed)} width={bw} height={Math.max(0, y(0) - y(m.fixed))} rx="2" fill={COLORS.fixed} />
                <rect className="flow-bar" style={{ animationDelay: delay }} x={xs} y={y(m.fixed + m.variable)} width={bw} height={Math.max(0, y(m.fixed) - y(m.fixed + m.variable))} rx="2" fill={COLORS.variable} />
                {/* Ahorro del mes */}
                <text x={cx} y={top - 7} textAnchor="middle" fontSize="9" fontWeight="600" fontFamily="var(--font-mono)"
                  fill={m.realSavings >= 0 ? "var(--color-profit)" : "var(--color-loss)"}>
                  {m.realSavings >= 0 ? "+" : ""}{compact(m.realSavings)}
                </text>
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)"
                  fill={on ? "var(--color-text)" : "var(--color-text-mute)"} fontWeight={on ? 600 : 400}>
                  {monthShort(m.month)}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

// §5.1 "Flujo del mes": reparto del ingreso de este mes y los últimos meses.
export function CashFlowCard({ months, selected }: { months: FlowMonth[]; selected: string }): ReactElement {
  const current = months.find(m => m.month === selected) ?? months[months.length - 1]!
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 px-4 py-4">
      <div className="lg:col-span-2"><Allocation m={current} /></div>
      <div className="lg:col-span-3"><History months={months} selected={selected} /></div>
    </div>
  )
}
