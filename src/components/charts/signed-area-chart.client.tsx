"use client"

// Port of SignedAreaChart from .claude-docs/tradeos_design/reports-charts.jsx
// Smooth (Catmull-Rom) signed area chart — green above 0 / red below 0.
// Optional right-axis overlay lines (e.g. trade count, avg win).
// Uses CSS vars from the TradeOS design system instead of window.T.

import { useState, useMemo } from "react"
import type { ReactElement } from "react"
import { formatCompactCurrency, formatCurrency } from "~/helpers/format"
import { smoothD } from "./smooth-path"

export type ChartPoint = {
  label: string
  v:     number
}

export type RightLine = {
  label:  string
  color:  string
  values: number[]
}

type Props = {
  uid:         string
  data:        ChartPoint[]
  rightLines?: RightLine[]
  height?:     number
  fewLabels?:  boolean
  legend?:     { label: string; color: string }[]
}

export function SignedAreaChart(props: Props): ReactElement {
  const { uid, data, rightLines = [], height = 240, fewLabels = false, legend } = props
  const [hover, setHover] = useState<number | null>(null)

  const W = 720, H = height
  const hasRight = rightLines.length > 0
  const padL = 56, padR = hasRight ? 52 : 16, padT = 18, padB = 34
  const ww = W - padL - padR
  const hh = H - padT - padB

  // Memoize all derived geometry — recomputed only when data/height/options change,
  // not on every hover state update.
  const geo = useMemo(() => {
    const vals = data.map(d => d.v)
    const vmin = Math.min(0, ...vals)
    const vmax = Math.max(0, ...vals)
    const vr   = (vmax - vmin) || 1

    const xOf = (i: number) => padL + (data.length === 1 ? ww / 2 : (i / (data.length - 1)) * ww)
    const yOf = (v: number) => padT + hh - ((v - vmin) / vr) * hh
    const y0  = yOf(0)

    const pts   = data.map((d, i) => [xOf(i), yOf(d.v)] as [number, number])
    const lineD = smoothD(pts)
    const areaD = lineD + ` L ${xOf(data.length - 1)},${y0} L ${xOf(0)},${y0} Z`

    const lineMax = rightLines.map(l => Math.max(...l.values, 1))
    const yr = (v: number, mi: number) => padT + hh - (v / lineMax[mi]!) * hh * 0.92

    const gridN = 4
    const grid = Array.from({ length: gridN + 1 }, (_, i) => {
      const v = vmin + (vr * i) / gridN
      return { y: yOf(v), v }
    })

    const labelIdx = fewLabels
      ? Array.from({ length: 6 }, (_, i) => Math.round((i / 5) * (data.length - 1)))
      : data.map((_, i) => i)

    return { xOf, yOf, y0, pts, lineD, areaD, lineMax, yr, grid, labelIdx, vmin, vr, ww }
  }, [data, fewLabels, rightLines, padL, padT, ww, hh])

  const { xOf, y0, lineD, areaD, lineMax, yr, grid, labelIdx } = geo

  const uidPos = `${uid}-pos`
  const uidNeg = `${uid}-neg`
  const uidTop = `${uid}-top`
  const uidBot = `${uid}-bot`

  const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", overflow: "hidden" }}
      >
        <defs>
          <linearGradient id={uidPos} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--color-profit)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--color-profit)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={uidNeg} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"   stopColor="var(--color-loss)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--color-loss)" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id={uidTop}><rect x="0" y="0" width={W} height={y0} /></clipPath>
          <clipPath id={uidBot}><rect x="0" y={y0} width={W} height={H - y0} /></clipPath>
        </defs>

        {/* Left axis grid labels */}
        {grid.map((g, i) => (
          <text
            key={i}
            x={padL - 8} y={g.y + 3}
            textAnchor="end" fontSize="9.5"
            fill="var(--color-text-mute)" fontFamily={monoFont}
          >
            {formatCompactCurrency(g.v)}
          </text>
        ))}

        {/* Right axis labels (first right line scale) */}
        {hasRight && [0, lineMax[0]! / 2, lineMax[0]!].map((v, i) => (
          <text
            key={i}
            x={W - padR + 8} y={yr(v, 0) + 3}
            textAnchor="start" fontSize="9.5"
            fill="var(--color-text-mute)" fontFamily={monoFont}
          >
            {Math.round(v)}
          </text>
        ))}

        {/* Zero reference line */}
        <line
          x1={padL} y1={y0} x2={W - padR} y2={y0}
          stroke="var(--color-border-hi)" strokeWidth="1"
        />

        {/* Positive area + line */}
        <g clipPath={`url(#${uidTop})`}>
          <path d={areaD} fill={`url(#${uidPos})`} />
          <path
            d={lineD} fill="none"
            stroke="var(--color-profit)" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
          />
        </g>

        {/* Negative area + line */}
        <g clipPath={`url(#${uidBot})`}>
          <path d={areaD} fill={`url(#${uidNeg})`} />
          <path
            d={lineD} fill="none"
            stroke="var(--color-loss)" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
          />
        </g>

        {/* Right-axis overlay lines */}
        {rightLines.map((l, li) => {
          const lp = l.values.map((v, i) => [xOf(i), yr(v, li)] as [number, number])
          return (
            <g key={li}>
              <path
                d={smoothD(lp)} fill="none"
                stroke={l.color} strokeWidth="1.6"
                strokeLinejoin="round" strokeLinecap="round"
                opacity="0.95"
              />
              {!fewLabels && lp.map((p, i) => (
                <circle
                  key={i}
                  cx={p[0]} cy={p[1]} r="2.6"
                  fill="var(--color-bg)" stroke={l.color} strokeWidth="1.4"
                />
              ))}
            </g>
          )
        })}

        {/* X-axis labels */}
        {labelIdx.map((i) => (
          <text
            key={i}
            x={xOf(i)} y={H - 10}
            textAnchor="middle" fontSize="9.5"
            fill={hover === i ? "var(--color-text)" : "var(--color-text-mute)"}
            fontFamily={monoFont}
          >
            {data[i]!.label}
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

        {/* Hover vertical line */}
        {hover != null && (
          <line
            x1={xOf(hover)} x2={xOf(hover)} y1={padT} y2={padT + hh}
            stroke="var(--color-border-hi)" strokeWidth="1" strokeDasharray="2 3"
          />
        )}
      </svg>

      {/* Legend */}
      {legend && (
        <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 4 }}>
          {legend.map((l, i) => (
            <span
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-text-mute)" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 4, background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}

      {/* Hover tooltip */}
      {hover != null && data[hover] != null && (
        <div
          style={{
            position:      "absolute",
            left:          `${(xOf(hover) / W) * 100}%`,
            top:           6,
            transform:     "translate(-50%,-100%)",
            background:    "var(--color-surface-2)",
            border:        "1px solid var(--color-border)",
            borderRadius:  6,
            padding:       "7px 10px",
            pointerEvents: "none",
            whiteSpace:    "nowrap",
            zIndex:        5,
            boxShadow:     "0 8px 28px rgba(0,0,0,.5)",
          }}
        >
          <div
            style={{
              fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
              color: "var(--color-text-mute)", textTransform: "uppercase", marginBottom: 4,
            }}
          >
            {data[hover]!.label}
          </div>
          <div
            style={{
              fontFamily: monoFont, fontSize: 11,
              color: data[hover]!.v >= 0 ? "var(--color-profit)" : "var(--color-loss)",
            }}
          >
            {formatCurrency(data[hover]!.v, { sign: true, decimals: 2 })}
          </div>
          {rightLines.map((l, li) => (
            <div
              key={li}
              style={{ fontFamily: monoFont, fontSize: 10.5, color: l.color, marginTop: 2 }}
            >
              {l.label}: {Math.round(l.values[hover] ?? 0)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
