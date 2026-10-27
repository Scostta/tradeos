"use client"

// Dos líneas base 100 (satélite vs. benchmark), mismo estilo SVG que
// src/components/charts (smoothD, grid mono, tooltip al pasar el ratón).

import { useState } from "react"
import type { ReactElement } from "react"
import { smoothD } from "~/components/charts/smooth-path"

export type GrowthPoint = {
  label:     string
  satellite: number | null
  benchmark: number | null
}

type Props = {
  data:    GrowthPoint[]
  labels:  { satellite: string; benchmark: string }
  height?: number
}

const SAT_COLOR = "var(--color-accent)"
const BENCH_COLOR = "var(--color-long)"
const MONO = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

/** Paso "redondo" (1, 2, 2.5, 5 × 10^k) para unas ~4 divisiones. */
function niceStep(range: number): number {
  const raw = range / 4
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].find(m => m * pow >= raw) ?? 10
  return step * pow
}

export function GrowthChart({ data, labels, height = 300 }: Props): ReactElement {
  const [hover, setHover] = useState<number | null>(null)

  const W = 1100, H = height
  const padL = 44, padR = 16, padT = 18, padB = 34
  const ww = W - padL - padR
  const hh = H - padT - padB

  const values = data.flatMap(d => [d.satellite, d.benchmark]).filter((v): v is number => v != null)
  const lo = Math.min(...values, 100)
  const hi = Math.max(...values, 100)
  const step = niceStep(Math.max(hi - lo, 4))
  const vmin = Math.floor(lo / step) * step
  const vmax = Math.ceil(hi / step) * step
  const vr = vmax - vmin || step

  const xOf = (i: number) => padL + (data.length === 1 ? ww / 2 : (i / (data.length - 1)) * ww)
  const yOf = (v: number) => padT + hh - ((v - vmin) / vr) * hh
  const line = (key: "satellite" | "benchmark") =>
    data.flatMap((d, i) => (d[key] == null ? [] : [[xOf(i), yOf(d[key] as number)] as [number, number]]))

  const sat = line("satellite")
  const bench = line("benchmark")
  const grid = Array.from({ length: Math.round(vr / step) + 1 }, (_, i) => vmin + step * i)
  const every = Math.max(1, Math.ceil(data.length / 8))

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "hidden" }}>
        {grid.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} stroke="var(--color-border)" strokeDasharray={v === 100 ? undefined : "2 4"} />
            <text x={padL - 8} y={yOf(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--color-text-mute)" fontFamily={MONO}>
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={smoothD(bench)} fill="none" stroke={BENCH_COLOR} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d={smoothD(sat)} fill="none" stroke={SAT_COLOR} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => (
          <g key={i}>
            {d.benchmark != null && (
              <circle cx={xOf(i)} cy={yOf(d.benchmark)} r={hover === i ? 3.6 : 2.4} fill="var(--color-bg)" stroke={BENCH_COLOR} strokeWidth="1.4" />
            )}
            {d.satellite != null && (
              <circle cx={xOf(i)} cy={yOf(d.satellite)} r={hover === i ? 4 : 2.8} fill="var(--color-bg)" stroke={SAT_COLOR} strokeWidth="1.6" />
            )}
            {(i % every === 0 || i === data.length - 1) && (
              <text
                x={xOf(i)} y={H - 10} textAnchor="middle" fontSize="9.5" fontFamily={MONO}
                fill={hover === i ? "var(--color-text)" : "var(--color-text-mute)"}
              >
                {d.label}
              </text>
            )}
            <rect
              x={xOf(i) - ww / Math.max(data.length, 1) / 2} y={padT}
              width={ww / Math.max(data.length, 1)} height={hh} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>

      {hover != null && data[hover] && (
        <div
          className="absolute pointer-events-none whitespace-nowrap rounded-md border border-border bg-surface-2 px-2.5 py-1.5"
          style={{
            left: `${(xOf(hover) / W) * 100}%`, top: 8, transform: "translateX(-50%)",
            boxShadow: "0 8px 28px rgba(0,0,0,.5)",
          }}
        >
          <div className="label-caps mb-1">{data[hover].label}</div>
          {([["satellite", labels.satellite, SAT_COLOR], ["benchmark", labels.benchmark, BENCH_COLOR]] as const).map(([key, label, color]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full" style={{ background: color }} />
              <span className="text-text-mute">{label}</span>
              <span className="mono text-text ml-auto pl-3">{data[hover][key]?.toFixed(1) ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
