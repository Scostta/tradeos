"use client"

// Port of MiniBars from .claude-docs/tradeos_design/reports-charts.jsx
// Vertical bars; mode "signed" = green/red by sign; mode "pos" = always green (profit color).

import type { ReactElement } from "react"
import { formatCompactCurrency } from "~/helpers/format"

type BarPoint = {
  label?: string
  v:      number
}

type Props = {
  data:      BarPoint[]
  height?:   number
  mode?:     "signed" | "pos"
  labelKey?: string
}

export function MiniBars(props: Props): ReactElement {
  const { data, height = 240, mode = "signed" } = props

  const W = 720, H = height
  const padL = 50, padR = 14, padT = 16, padB = 28
  const ww = W - padL - padR
  const hh = H - padT - padB

  const vals = data.map(d => d.v)
  const vmin = Math.min(0, ...vals)
  const vmax = Math.max(0, ...vals)
  const vr   = (vmax - vmin) || 1

  const yOf = (v: number) => padT + hh - ((v - vmin) / vr) * hh
  const y0  = yOf(0)
  const step = ww / Math.max(data.length, 1)

  const grid = Array.from({ length: 5 }, (_, i) => {
    const v = vmin + (vr * i) / 4
    return { y: yOf(v), v }
  })

  const labelEvery = data.length > 14 ? Math.ceil(data.length / 8) : 1
  const monoFont   = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Y-axis labels */}
      {grid.map((g, i) => (
        <text
          key={i}
          x={padL - 7} y={g.y + 3}
          textAnchor="end" fontSize="9.5"
          fill="var(--color-text-mute)" fontFamily={monoFont}
        >
          {formatCompactCurrency(g.v)}
        </text>
      ))}

      {/* Zero reference line */}
      <line
        x1={padL} y1={y0} x2={W - padR} y2={y0}
        stroke="var(--color-border-hi)" strokeWidth="1"
      />

      {/* Bars */}
      {data.map((d, i) => {
        const top = d.v >= 0 ? yOf(d.v) : y0
        const h   = Math.max(1, Math.abs(yOf(d.v) - y0))
        const bw  = Math.min(36, step * (data.length > 30 ? 0.72 : 0.5))
        const col = mode === "signed"
          ? (d.v >= 0 ? "var(--color-profit)" : "var(--color-loss)")
          : "var(--color-profit)"
        return (
          <rect
            key={i}
            x={padL + step * i + step / 2 - bw / 2}
            y={top}
            width={bw}
            height={h}
            rx="1.5"
            fill={col}
            opacity="0.85"
          />
        )
      })}

      {/* X-axis labels (sparse) */}
      {data.map((d, i) =>
        i % labelEvery === 0 && d.label != null ? (
          <text
            key={`l${i}`}
            x={padL + step * i + step / 2}
            y={H - 9}
            textAnchor="middle" fontSize="9.5"
            fill="var(--color-text-mute)" fontFamily={monoFont}
          >
            {d.label}
          </text>
        ) : null
      )}
    </svg>
  )
}
