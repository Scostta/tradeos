"use client"

// Dos paneles: cierres mensuales ajustados con su SMA 10 arriba y el ratio
// precio/benchmark (100 = primer mes) abajo. Mismo estilo SVG que
// src/components/charts (smoothD, eje mono, tooltip).

import { useState } from "react"
import type { ReactElement } from "react"
import { smoothD } from "~/components/charts/smooth-path"
import type { PricePoint } from "~/lib/calculations/invest-detail"

const MONO = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"
const PRICE = "var(--color-text)"
const SMA = "var(--color-accent)"
const REL = "var(--color-long)"

type Props = {
  data:     PricePoint[]
  currency: string | null
  labels:   { price: string; sma: string; relative: string }
}

function label(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
}

function scale(values: number[], pad = 0.06): { min: number; max: number } {
  const lo = Math.min(...values), hi = Math.max(...values)
  const span = hi - lo || Math.abs(hi) || 1
  return { min: lo - span * pad, max: hi + span * pad }
}

export function PriceChart({ data, currency, labels }: Props): ReactElement {
  const [hover, setHover] = useState<number | null>(null)

  const W = 1100, padL = 56, padR = 16
  const topT = 14, topH = 210, gap = 34, botH = 90, padB = 26
  const H = topT + topH + gap + botH + padB
  const ww = W - padL - padR

  const xOf = (i: number) => padL + (data.length === 1 ? ww / 2 : (i / (data.length - 1)) * ww)
  const top = scale(data.flatMap(d => [d.close, d.sma10]).filter((v): v is number => v != null))
  const rel = scale(data.map(d => d.relative).filter((v): v is number => v != null).concat(100))
  const yTop = (v: number) => topT + topH - ((v - top.min) / (top.max - top.min)) * topH
  const botT = topT + topH + gap
  const yBot = (v: number) => botT + botH - ((v - rel.min) / (rel.max - rel.min)) * botH

  const pts = (f: (d: PricePoint) => number | null, y: (v: number) => number) =>
    data.flatMap((d, i) => { const v = f(d); return v == null ? [] : [[xOf(i), y(v)] as [number, number]] })

  const every = Math.max(1, Math.ceil(data.length / 9))
  const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 0 : 2 })
  const hovered = hover != null ? data[hover] : null

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "hidden" }}>
        {[0, 0.5, 1].map(f => {
          const v = top.min + (top.max - top.min) * f
          return (
            <g key={`t${f}`}>
              <line x1={padL} x2={W - padR} y1={yTop(v)} y2={yTop(v)} stroke="var(--color-border)" strokeDasharray="2 4" />
              <text x={padL - 8} y={yTop(v) + 3} textAnchor="end" fontSize="10" fill="var(--color-text-mute)" fontFamily={MONO}>{fmt(v)}</text>
            </g>
          )
        })}
        <path d={smoothD(pts(d => d.sma10, yTop))} fill="none" stroke={SMA} strokeWidth="1.6" strokeDasharray="5 4" />
        <path d={smoothD(pts(d => d.close, yTop))} fill="none" stroke={PRICE} strokeWidth="2" strokeLinejoin="round" />

        <line x1={padL} x2={W - padR} y1={yBot(100)} y2={yBot(100)} stroke="var(--color-border-hi)" />
        <text x={padL - 8} y={yBot(100) + 3} textAnchor="end" fontSize="10" fill="var(--color-text-mute)" fontFamily={MONO}>100</text>
        <path d={smoothD(pts(d => d.relative, yBot))} fill="none" stroke={REL} strokeWidth="1.8" />

        {data.map((d, i) => (
          <g key={d.month}>
            {(i % every === 0 || i === data.length - 1) && (
              <text x={xOf(i)} y={H - 8} textAnchor="middle" fontSize="10" fontFamily={MONO}
                fill={hover === i ? "var(--color-text)" : "var(--color-text-mute)"}>
                {label(d.monthEnd)}
              </text>
            )}
            {hover === i && <line x1={xOf(i)} x2={xOf(i)} y1={topT} y2={botT + botH} stroke="var(--color-border-hi)" />}
            <rect x={xOf(i) - ww / data.length / 2} y={topT} width={ww / data.length} height={botT + botH - topT}
              fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          </g>
        ))}
      </svg>

      {hovered && hover != null && (
        <div
          className="absolute pointer-events-none whitespace-nowrap rounded-md border border-border bg-surface-2 px-2.5 py-1.5"
          style={{ left: `${(xOf(hover) / W) * 100}%`, top: 6, transform: "translateX(-50%)", boxShadow: "0 8px 28px rgba(0,0,0,.5)" }}
        >
          <div className="label-caps mb-1">{label(hovered.monthEnd)}</div>
          {([
            [labels.price, PRICE, hovered.close.toFixed(2) + (currency ? ` ${currency}` : "")],
            [labels.sma, SMA, hovered.sma10?.toFixed(2) ?? "—"],
            [labels.relative, REL, hovered.relative?.toFixed(1) ?? "—"],
          ] as const).map(([name, color, value]) => (
            <div key={name} className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full" style={{ background: color }} />
              <span className="text-text-mute">{name}</span>
              <span className="mono text-text ml-auto pl-3">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
