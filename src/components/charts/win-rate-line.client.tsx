"use client"

// Port of WinRateLine from .claude-docs/tradeos_design/reports-charts.jsx
// Single smooth line, dots, y-axis in percentage.

import { useState } from "react"
import type { ReactElement } from "react"
import { smoothD } from "./smooth-path"

type Point = {
  label: string
  v:     number  // 0–1 fraction (rendered as %)
}

type Props = {
  uid?:    string
  data:    Point[]
  height?: number
  color?:  string
}

export function WinRateLine(props: Props): ReactElement {
  const { uid = "wr", data, height = 240, color = "var(--color-long)" } = props
  const [hover, setHover] = useState<number | null>(null)

  const W = 720, H = height
  const padL = 44, padR = 16, padT = 18, padB = 34
  const ww = W - padL - padR
  const hh = H - padT - padB

  // Convert 0–1 fractions to percentages for display
  const pctVals = data.map(d => d.v * 100)
  const rawMin  = Math.min(...pctVals)
  const rawMax  = Math.max(...pctVals)
  const vmin    = Math.max(0,   Math.floor((rawMin - 5) / 5) * 5)
  const vmax    = Math.min(100, Math.ceil((rawMax  + 5) / 5) * 5)
  const vr      = (vmax - vmin) || 1

  const xOf = (i: number) => padL + (data.length === 1 ? ww / 2 : (i / (data.length - 1)) * ww)
  const yOf = (v: number) => padT + hh - ((v - vmin) / vr) * hh

  const pts  = pctVals.map((v, i) => [xOf(i), yOf(v)] as [number, number])
  const grid = Array.from({ length: 5 }, (_, i) => {
    const v = vmin + (vr * i) / 4
    return { y: yOf(v), v }
  })

  const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Grid y labels */}
        {grid.map((g, i) => (
          <text
            key={i}
            x={padL - 8} y={g.y + 3}
            textAnchor="end" fontSize="9.5"
            fill="var(--color-text-mute)" fontFamily={monoFont}
          >
            {Math.round(g.v)}%
          </text>
        ))}

        {/* Line */}
        <path
          d={smoothD(pts)} fill="none"
          stroke={color} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"
        />

        {/* Dots */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p[0]} cy={p[1]}
            r={hover === i ? 4 : 2.8}
            fill="var(--color-bg)"
            stroke={color} strokeWidth="1.6"
          />
        ))}

        {/* X labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={xOf(i)} y={H - 10}
            textAnchor="middle" fontSize="9.5"
            fill={hover === i ? "var(--color-text)" : "var(--color-text-mute)"}
            fontFamily={monoFont}
          >
            {d.label}
          </text>
        ))}

        {/* Hover hit areas */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={xOf(i) - ww / data.length / 2}
            y={padT}
            width={ww / data.length}
            height={hh}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "pointer" }}
          />
        ))}
      </svg>

      {/* Hover tooltip */}
      {hover != null && data[hover] != null && (
        <div
          style={{
            position:      "absolute",
            left:          `${(xOf(hover) / W) * 100}%`,
            top:           pts[hover] != null ? pts[hover]![1] - 2 : 6,
            transform:     "translate(-50%,-100%)",
            background:    "var(--color-surface-2)",
            border:        "1px solid var(--color-border)",
            borderRadius:  6,
            padding:       "6px 9px",
            pointerEvents: "none",
            whiteSpace:    "nowrap",
            zIndex:        5,
            boxShadow:     "0 8px 28px rgba(0,0,0,.5)",
          }}
        >
          <div
            style={{
              fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
              color: "var(--color-text-mute)", textTransform: "uppercase", marginBottom: 3,
            }}
          >
            {data[hover]!.label}
          </div>
          <div style={{ fontFamily: monoFont, fontSize: 11, color }}>
            {(data[hover]!.v * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  )
}
