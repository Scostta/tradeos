import type { ReactElement } from "react"
import type { BeMae } from "~/lib/calculations/be-analysis"
import { BE_NEAR_STOP_R, BE_NO_RISK_R } from "~/lib/calculations/be-analysis"
import { REPORTS } from "~/constants/copies/reports"
import { cn } from "~/utils/cn"

const C = REPORTS.BE.MAE
const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

const fmtR = (r: number): string => `${r.toFixed(2)}R`

// ¿Cuánto fueron en contra los BE antes de volver? MAE en R, y su cruce con
// el MFE: arriba a la derecha, los que casi tocan el stop y además pasaron +1R.
export function BeMaeCard({ mae, total }: { mae: BeMae; total: number }): ReactElement {
  const cells = [
    { label: C.AVG,                                            value: mae.avgMaeR != null ? fmtR(mae.avgMaeR) : "—", warn: false },
    { label: C.NEAR_STOP.replace("{r}", String(BE_NEAR_STOP_R)), value: String(mae.nearStop),    warn: mae.nearStop > 0 },
    { label: C.NO_RISK.replace("{r}", String(BE_NO_RISK_R)),     value: String(mae.neverAtRisk), warn: false },
  ]

  return (
    <div className="card p-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 border-b border-border">
        <span className="label-caps">{C.TITLE}</span>
        <span className="mono text-xs text-text-mute ml-auto">
          {C.COVERAGE.replace("{measured}", String(mae.measured)).replace("{total}", String(total))}
        </span>
      </div>

      {mae.measured === 0 ? (
        <div className="px-4 py-6 text-sm text-text-mute">{C.NOT_MEASURED}</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px bg-border border-b border-border">
            {cells.map(c => (
              <div key={c.label} className="bg-surface px-4 py-3.5 flex flex-col gap-1">
                <span className="label-caps">{c.label}</span>
                <span className={cn("mono text-xl font-semibold", c.warn ? "text-short" : "text-text")}>
                  {c.value}
                  {c.label !== C.AVG && <span className="text-sm text-text-mute font-normal"> / {mae.measured}</span>}
                </span>
              </div>
            ))}
          </div>
          {mae.points.length > 0 && <Scatter points={mae.points} />}
          <div className="px-4 py-2.5 text-xs text-text-mute border-t border-border">{C.HINT}</div>
        </>
      )}
    </div>
  )
}

function Scatter({ points }: { points: BeMae["points"] }): ReactElement {
  const W = 960, H = 220, padL = 40, padR = 16, padT = 14, padB = 34
  const maxX = Math.max(1.2, ...points.map(p => p.maeR)) * 1.05
  const maxY = Math.max(1.5, ...points.map(p => p.mfeR)) * 1.05
  const x = (v: number): number => padL + (v / maxX) * (W - padL - padR)
  const y = (v: number): number => H - padB - (v / maxY) * (H - padT - padB)
  const ticksX = [0, 0.5, 1, 1.5, 2, 3, 4].filter(t => t <= maxX)
  const ticksY = [0, 1, 2, 3, 4, 6, 8].filter(t => t <= maxY)

  return (
    <div className="px-4 py-3">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {ticksY.map(t => (
          <g key={`y${t}`}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fontFamily={monoFont} fill="var(--color-text-mute)">{t}R</text>
          </g>
        ))}
        {ticksX.map(t => (
          <text key={`x${t}`} x={x(t)} y={H - padB + 14} textAnchor="middle" fontSize="10" fontFamily={monoFont} fill="var(--color-text-mute)">{t}R</text>
        ))}
        <line x1={x(BE_NEAR_STOP_R)} x2={x(BE_NEAR_STOP_R)} y1={padT} y2={H - padB} stroke="var(--color-short)" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
        <line x1={padL} x2={W - padR} y1={y(1)} y2={y(1)} stroke="var(--color-short)" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
        {points.map(p => (
          <circle
            key={p.id}
            cx={x(p.maeR)} cy={y(p.mfeR)} r="5"
            fill={p.mfeR >= 1 ? "var(--color-short)" : "var(--color-text-dim)"}
            fillOpacity="0.8"
            stroke="var(--color-surface)" strokeWidth="1"
          />
        ))}
        <text x={W - padR} y={H - 4} textAnchor="end" fontSize="10" fill="var(--color-text-mute)">{C.AXIS_X}</text>
        <text x={padL} y={padT - 2} fontSize="10" fill="var(--color-text-mute)">{C.AXIS_Y}</text>
      </svg>
    </div>
  )
}
