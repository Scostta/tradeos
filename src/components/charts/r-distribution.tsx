import type { ReactElement } from "react"
import type { RBucket } from "~/types/reports"

const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

/** R-multiple distribution histogram. Negative buckets red, positive green. */
export function RDistribution({ distribution }: { distribution: RBucket[] }): ReactElement {
  const W = 720, H = 220, padT = 18, padB = 36, padL = 8, padR = 8
  const hh   = H - padT - padB
  const max  = Math.max(1, ...distribution.map(b => b.count))
  const step = (W - padL - padR) / distribution.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "hidden" }}>
      <line x1={padL} y1={padT + hh} x2={W - padR} y2={padT + hh} stroke="var(--color-border-hi)" strokeWidth="1" />
      {distribution.map((b, i) => {
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
