"use client"

import type { ReactElement } from "react"
import type { DowBucket } from "~/types/metrics"
import { DASHBOARD } from "~/constants/copies/dashboard"

type Props = { data: DowBucket[] }

function fmtAxisVal(v: number): string {
  const k = Math.round(Math.abs(v) / 100) / 10
  return (v < 0 ? "−$" : "$") + k + "k"
}

function fmtFooterVal(net: number): string {
  const k = Math.abs(net / 1000).toFixed(1)
  return (net >= 0 ? "+" : "−") + k + "k"
}

export function PnlByDayCard({ data }: Props): ReactElement {
  // Replay the bar animation when the data changes by remounting the group
  // under a key derived from the data (key-reset pattern — no effect needed).
  const animKey = data.map(d => `${d.key}:${d.net}`).join("|")

  const W = 272, H = 232
  const padL = 44, padR = 8, padT = 12, padB = 24
  const ww = W - padL - padR
  const hh = H - padT - padB

  const vals  = data.map(d => d.net)
  const min   = Math.min(0, ...vals)
  const max   = Math.max(0, ...vals)
  const range = max - min || 1
  const y     = (v: number) => padT + hh - ((v - min) / range) * hh
  const y0    = y(0)
  const barW  = ww / data.length

  const gridLines = 4
  const grid = Array.from({ length: gridLines + 1 }, (_, i) => {
    const v = min + (range * i) / gridLines
    return { y: y(v), v }
  })

  return (
    <div className="card p-4 flex flex-col" style={{ height: 320 }}>
      <style>{`
        @keyframes barScaleUp {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        .bar-up {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: barScaleUp 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .bar-down {
          transform-box: fill-box;
          transform-origin: 50% 0%;
          animation: barScaleUp 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>

      <div className="label-caps mb-3">{DASHBOARD.BY_DAY.LABEL}</div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: "block", overflow: "visible" }}
      >
        {grid.map((g, i) => (
          <g key={i}>
            <line
              x1={padL} y1={g.y} x2={W - padR} y2={g.y}
              stroke="var(--color-border)" strokeWidth="1"
              strokeDasharray={g.v === 0 ? "0" : "2 4"}
            />
            <text
              x={padL - 6} y={g.y + 3}
              textAnchor="end" fontSize="9"
              fill="var(--color-text-mute)"
              fontFamily="var(--mono)"
            >
              {fmtAxisVal(g.v)}
            </text>
          </g>
        ))}

        <g key={animKey}>
        {data.map((d, i) => {
          const v        = d.net
          const positive = v >= 0
          const top      = positive ? y(v) : y0
          const bot      = positive ? y0   : y(v)
          const bx       = padL + i * barW + barW * 0.18
          const bw       = barW * 0.64
          return (
            <g key={d.key}>
              <rect
                x={bx} y={top}
                width={bw}
                height={Math.max(1, bot - top)}
                fill={positive ? "var(--color-profit)" : "var(--color-loss)"}
                opacity="0.85"
                rx="1"
                className={positive ? "bar-up" : "bar-down"}
                style={{ animationDelay: `${i * 0.07}s` }}
              />
              <text
                x={bx + bw / 2} y={H - 8}
                fontSize="9.5" textAnchor="middle"
                fill="var(--color-text-mute)"
                fontFamily="var(--mono)"
              >
                {d.key}
              </text>
            </g>
          )
        })}
        </g>
      </svg>

      <div
        className="mt-auto pt-2.5 border-t border-border grid"
        style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}
      >
        {data.map(d => (
          <div key={d.key} className="text-center">
            <div className="label-caps mb-0.5">{d.key}</div>
            <div
              className="mono text-xs"
              style={{ color: d.net >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
            >
              {fmtFooterVal(d.net)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
