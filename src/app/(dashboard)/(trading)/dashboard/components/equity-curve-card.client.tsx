"use client"

import { useState, useEffect, useRef } from "react"
import type { ReactElement } from "react"
import type { EquityPoint } from "~/types/metrics"
import { DASHBOARD } from "~/constants/copies/dashboard"
import { formatCurrency, formatDate } from "~/helpers/format"
import { useTimezone } from "~/hooks/use-timezone"

type Mode = "line" | "area" | "candle"

type HoverState = {
  idx: number
  x:   number
  y:   number
  d:   EquityPoint
}

type Props = {
  data:   EquityPoint[]
  netPnl: number
}

function EquityChart({ data, mode }: { data: EquityPoint[]; mode: Mode }): ReactElement | null {
  const tz = useTimezone()
  const [hover, setHover] = useState<HoverState | null>(null)
  const lineRef = useRef<SVGPathElement>(null)
  const areaRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    if (mode === "candle") return

    const line = lineRef.current
    if (!line) return
    const len = line.getTotalLength()

    line.style.transition      = "none"
    line.style.strokeDasharray = `${len}`
    line.style.strokeDashoffset = `${len}`

    if (areaRef.current) {
      areaRef.current.style.transition = "none"
      areaRef.current.style.opacity    = "0"
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        line.style.transition         = "stroke-dashoffset 1.3s cubic-bezier(0.4, 0, 0.2, 1)"
        line.style.strokeDashoffset   = "0"
        if (areaRef.current) {
          areaRef.current.style.transition = "opacity 1.3s ease 0.1s"
          areaRef.current.style.opacity    = "1"
        }
      })
    })
  }, [data, mode])

  if (!data.length) return null

  const W = 760, H = 232
  const padL = 48, padR = 16, padT = 16, padB = 28
  const ww = W - padL - padR
  const hh = H - padT - padB

  const min   = Math.min(0, ...data.map(d => d.equity))
  const max   = Math.max(0, ...data.map(d => d.equity))
  const range = max - min || 1
  const x     = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * ww
  const y     = (v: number) => padT + hh - ((v - min) / range) * hh
  const y0    = y(0)

  const pts      = data.map((d, i) => [x(i), y(d.equity)] as [number, number])
  const linePath = "M" + pts.map(p => p.join(",")).join(" L")
  const areaPath = linePath + ` L${padL + ww},${y0} L${padL},${y0} Z`

  const gridLines = 5
  const grid = Array.from({ length: gridLines + 1 }, (_, i) => {
    const v = min + (range * i) / gridLines
    return { y: y(v), v }
  })

  const buckets    = 30
  const candleBars: Array<{ bx: number; bw: number; top: number; bot: number; yo: number; yc: number; up: boolean }> = []
  if (mode === "candle") {
    const bsize = Math.ceil(data.length / buckets)
    for (let b = 0; b < buckets; b++) {
      const slice = data.slice(b * bsize, (b + 1) * bsize)
      if (!slice.length) continue
      const open  = b === 0 ? 0 : data[b * bsize - 1]?.equity ?? 0
      const close = slice[slice.length - 1]!.equity
      const hi    = Math.max(open, close, ...slice.map(d => d.equity))
      const lo    = Math.min(open, close, ...slice.map(d => d.equity))
      const bx    = x(b * bsize + bsize / 2)
      const bw    = Math.max(3, (ww / buckets) * 0.7)
      candleBars.push({ bx, bw, top: y(hi), bot: y(lo), yo: y(open), yc: y(close), up: close >= open })
    }
  }

  const xTicks  = Math.min(6, data.length)
  const tickIdx = Array.from({ length: xTicks }, (_, i) =>
    Math.floor((i / Math.max(xTicks - 1, 1)) * (data.length - 1))
  )

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px   = (e.clientX - rect.left) * (W / rect.width)
    const idx  = Math.max(0, Math.min(data.length - 1, Math.round(((px - padL) / ww) * (data.length - 1))))
    const d    = data[idx]
    if (d) setHover({ idx, x: x(idx), y: y(d.equity), d })
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <style>{`
        @keyframes candleFade {
          from { opacity: 0; transform: scaleY(0.4); }
          to   { opacity: 1; transform: scaleY(1); }
        }
        .candle-bar {
          transform-box: fill-box;
          transform-origin: 50% 50%;
          animation: candleFade 0.35s ease both;
        }
      `}</style>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="eqArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--color-accent)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {grid.map((g, i) => (
          <g key={i}>
            <line
              x1={padL} y1={g.y} x2={W - padR} y2={g.y}
              stroke="var(--color-border)" strokeWidth="1"
              strokeDasharray={g.v === 0 ? "0" : "2 4"}
            />
            <text
              x={padL - 8} y={g.y + 3}
              textAnchor="end" fontSize="9.5"
              fill="var(--color-text-mute)" fontFamily="var(--mono)"
            >
              {g.v >= 0 ? "$" : "-$"}{Math.abs(g.v).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </text>
          </g>
        ))}

        {tickIdx.map((ti, i) => {
          const d = data[ti]
          return d ? (
            <text
              key={i} x={x(ti)} y={H - 8}
              fontSize="9.5" textAnchor="middle"
              fill="var(--color-text-mute)" fontFamily="var(--mono)"
            >
              {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}
            </text>
          ) : null
        })}

        {mode === "area" && (
          <path ref={areaRef} d={areaPath} fill="url(#eqArea)" />
        )}
        {(mode === "area" || mode === "line") && (
          <path
            ref={lineRef}
            d={linePath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {mode === "candle" && candleBars.map((b, i) => (
          <g
            key={i}
            className="candle-bar"
            style={{ animationDelay: `${i * 0.018}s` }}
          >
            <line
              x1={b.bx} x2={b.bx} y1={b.top} y2={b.bot}
              stroke={b.up ? "var(--color-profit)" : "var(--color-loss)"} strokeWidth="1"
            />
            <rect
              x={b.bx - b.bw / 2}
              y={Math.min(b.yo, b.yc)}
              width={b.bw}
              height={Math.max(2, Math.abs(b.yc - b.yo))}
              fill={b.up ? "var(--color-profit)" : "var(--color-loss)"}
              opacity="0.9"
            />
          </g>
        ))}

        {hover && (
          <g>
            <line
              x1={hover.x} x2={hover.x} y1={padT} y2={padT + hh}
              stroke="var(--color-border-hi)" strokeWidth="1" strokeDasharray="2 3"
            />
            <circle cx={hover.x} cy={hover.y} r="3.5" fill="var(--color-accent)" />
            <circle cx={hover.x} cy={hover.y} r="6"   fill="var(--color-accent)" opacity="0.18" />
          </g>
        )}
      </svg>

      {hover && (
        <div
          style={{
            position:   "absolute",
            left:       `${(hover.x / W) * 100}%`,
            top:        -4,
            transform:  "translate(-50%, -100%)",
            background: "var(--color-surface)",
            border:     "1px solid var(--color-border-hi)",
            borderRadius: 5,
            padding:    "6px 9px",
            fontFamily: "var(--mono)",
            fontSize:   10,
            color:      "var(--color-text)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow:  "0 4px 16px rgba(0,0,0,.4)",
          }}
        >
          <div style={{ color: "var(--color-text-mute)", marginBottom: 2 }}>
            {formatDate(hover.d.date, tz)}
          </div>
          <div style={{ color: hover.d.equity >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>
            {formatCurrency(hover.d.equity, { sign: false, decimals: 0 })}
          </div>
        </div>
      )}
    </div>
  )
}

const MODES: { id: Mode; label: string }[] = [
  { id: "line",   label: DASHBOARD.EQUITY.MODE_LINE },
  { id: "area",   label: DASHBOARD.EQUITY.MODE_AREA },
  { id: "candle", label: DASHBOARD.EQUITY.MODE_CANDLE },
]

export function EquityCurveCard({ data, netPnl }: Props): ReactElement {
  const [mode, setMode] = useState<Mode>("area")

  return (
    <div className="card p-5 flex flex-col" style={{ height: 320 }}>
      <div className="flex justify-between items-start mb-3.5">
        <div>
          <div className="label-caps">{DASHBOARD.EQUITY.LABEL}</div>
          <div
            className="mono text-3xl font-semibold tracking-tight mt-1.5"
            style={{ color: netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
          >
            {formatCurrency(netPnl, { sign: false, decimals: 2 })}
          </div>
        </div>
        <div className="flex gap-1.5">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="px-2.5 py-1 rounded text-sm transition-colors"
              style={{
                background: mode === m.id ? "var(--color-surface-2)" : "transparent",
                color:      mode === m.id ? "var(--color-text)"      : "var(--color-text-mute)",
                border:     `1px solid ${mode === m.id ? "var(--color-border-hi)" : "var(--color-border)"}`,
                cursor:     "pointer",
                fontFamily: "inherit",
                textTransform: "capitalize",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {data.length > 0 ? (
          <EquityChart key={`${data.length}-${mode}`} data={data} mode={mode} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-text-mute">
            {DASHBOARD.EMPTY.MESSAGE}
          </div>
        )}
      </div>
    </div>
  )
}
