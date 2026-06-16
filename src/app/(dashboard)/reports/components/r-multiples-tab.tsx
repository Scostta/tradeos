import type { ReactElement } from "react"
import type { RStats, RBucket } from "~/types/reports"
import { REPORTS } from "~/constants/copies/reports"
import { formatPct } from "~/helpers/format"

const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

type StatCell = { label: string; value: string; kind: "profit" | "loss" | "neutral" }

const KIND_COLOR: Record<StatCell["kind"], string> = {
  profit:  "var(--color-profit)",
  loss:    "var(--color-loss)",
  neutral: "var(--color-text)",
}

const fmtR = (r: number): string => `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(2)}R`

function buildGrid(s: RStats): StatCell[] {
  return [
    { label: REPORTS.R_MULTIPLES.STATS.EXPECTANCY, value: fmtR(s.expectancy), kind: s.expectancy >= 0 ? "profit" : "loss" },
    { label: REPORTS.R_MULTIPLES.STATS.TOTAL_R,    value: fmtR(s.totalR),     kind: s.totalR >= 0 ? "profit" : "loss" },
    { label: REPORTS.R_MULTIPLES.STATS.AVG_WIN_R,  value: fmtR(s.avgRWin),    kind: "profit" },
    { label: REPORTS.R_MULTIPLES.STATS.AVG_LOSS_R, value: fmtR(s.avgRLoss),   kind: "loss" },
    { label: REPORTS.R_MULTIPLES.STATS.WIN_RATE,   value: formatPct(s.winRate), kind: s.winRate >= 0.5 ? "profit" : "neutral" },
    { label: REPORTS.R_MULTIPLES.STATS.SQN,        value: s.sqn.toFixed(2),   kind: s.sqn >= 2 ? "profit" : "neutral" },
    { label: REPORTS.R_MULTIPLES.STATS.BEST_R,     value: fmtR(s.bestR),      kind: "profit" },
    { label: REPORTS.R_MULTIPLES.STATS.WORST_R,    value: fmtR(s.worstR),     kind: "loss" },
  ]
}

function RHistogram({ dist }: { dist: RBucket[] }): ReactElement {
  const W = 720, H = 220, padT = 18, padB = 36, padL = 8, padR = 8
  const hh   = H - padT - padB
  const max  = Math.max(1, ...dist.map(b => b.count))
  const step = (W - padL - padR) / dist.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      <line x1={padL} y1={padT + hh} x2={W - padR} y2={padT + hh} stroke="var(--color-border-hi)" strokeWidth="1" />
      {dist.map((b, i) => {
        const h     = (b.count / max) * hh
        const cx    = padL + step * i + step / 2
        const bw    = Math.min(52, step * 0.62)
        const color = b.negative ? "var(--color-loss)" : "var(--color-profit)"
        return (
          <g key={b.label}>
            {b.count > 0 && (
              <text x={cx} y={padT + hh - h - 6} textAnchor="middle" fontSize="10" fontFamily={monoFont} fill="var(--color-text-dim)">
                {b.count}
              </text>
            )}
            <rect x={cx - bw / 2} y={padT + hh - h} width={bw} height={Math.max(0, h)} rx="2" fill={color} opacity="0.85" />
            <text x={cx} y={H - 12} textAnchor="middle" fontSize="9.5" fontFamily={monoFont} fill="var(--color-text-mute)">
              {b.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function RMultiplesTab({ rStats }: { rStats: RStats }): ReactElement {
  const { coverage } = rStats

  if (coverage.withR === 0) {
    return (
      <div className="card p-8 max-w-lg mx-auto text-center flex flex-col items-center gap-3">
        <div className="text-md font-semibold text-text">{REPORTS.R_MULTIPLES.NO_STOPS_TITLE}</div>
        <div className="text-sm text-text-mute">{REPORTS.R_MULTIPLES.NO_STOPS_MSG}</div>
      </div>
    )
  }

  const grid = buildGrid(rStats)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Headline expectancy + coverage */}
      <div className="card" style={{ padding: "18px 20px", display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <div className="label-caps">{REPORTS.R_MULTIPLES.EXPECTANCY_LABEL}</div>
        <div
          style={{ fontFamily: monoFont, fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums",
            color: rStats.expectancy >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
        >
          {fmtR(rStats.expectancy)}
        </div>
        <div className="text-sm text-text-mute">{REPORTS.R_MULTIPLES.EXPECTANCY_UNIT}</div>
        <div className="mono text-xs text-text-mute" style={{ marginLeft: "auto" }}>
          {coverage.withR} {REPORTS.R_MULTIPLES.OF} {coverage.total} {REPORTS.R_MULTIPLES.TRADES} {REPORTS.R_MULTIPLES.COVERAGE}
        </div>
      </div>

      {/* Distribution */}
      <ChartFrameLite
        label={REPORTS.R_MULTIPLES.DIST_LABEL}
        legend={[
          { label: REPORTS.R_MULTIPLES.STATS.AVG_WIN_R,  color: "var(--color-profit)" },
          { label: REPORTS.R_MULTIPLES.STATS.AVG_LOSS_R, color: "var(--color-loss)" },
        ]}
      >
        <RHistogram dist={rStats.distribution} />
      </ChartFrameLite>

      {/* Stats grid */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {grid.map((cell, i) => (
            <div
              key={i}
              style={{
                padding:      "16px 18px",
                borderRight:  (i % 4 !== 3) ? "1px solid var(--color-border)" : "none",
                borderBottom: (i < grid.length - 4) ? "1px solid var(--color-border)" : "none",
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.1em", color: "var(--color-text-mute)", textTransform: "uppercase", marginBottom: 7 }}>
                {cell.label}
              </div>
              <div style={{ fontFamily: monoFont, fontSize: 19, fontWeight: 600, color: KIND_COLOR[cell.kind], fontVariantNumeric: "tabular-nums" }}>
                {cell.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Local frame (reuses the reports ChartFrame look) to keep this tab self-contained.
function ChartFrameLite({ label, legend, children }: {
  label: string
  legend: { label: string; color: string }[]
  children: ReactElement
}): ReactElement {
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column" }}>
      <div className="label-caps" style={{ marginBottom: 14 }}>{label}</div>
      {children}
      <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 4 }}>
        {legend.map((l, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-text-mute)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}
