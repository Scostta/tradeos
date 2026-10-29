"use client"

import { useEffect, useRef, useState } from "react"
import type { ReactElement } from "react"
import { ColorType, CrosshairMode, LineType, createChart } from "lightweight-charts"
import { smoothD } from "~/components/charts/smooth-path"
import { INVEST } from "~/constants/copies/invest"
import { stepsInRange } from "~/lib/calculations/invest-position-chart"
import type { StepPoint } from "~/lib/calculations/invest-position-chart"
import type { PricePoint } from "~/lib/calculations/invest-detail"
import type { InvestBar, InvestBarsResponse } from "~/app/api/invest/bars/route"
import { cn } from "~/utils/cn"
import { fmtDay } from "../../components/invest-format"

const D = INVEST.DETAIL
const HEIGHT = 340

type Interval = "1mo" | "1d"
type State = { status: "loading" } | { status: "error" } | { status: "ready"; bars: InvestBar[] }

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`

// §4.7: velas mensuales (36 m, la "foto" completa) o diarias (18 m), ajustadas,
// con la SMA 10 de la regla (cierres mensuales ajustados de invest_prices) y,
// debajo, el precio relativo al benchmark.
export function TickerChart({ ticker, currency, series, steps, benchmark }: {
  ticker:    string
  currency:  string | null       // divisa de cotización (GBp = peniques)
  series:    PricePoint[]        // cierres mensuales con SMA 10 y relativo (priceChartSeries)
  steps:     StepPoint[]         // SMA 10 escalonada para las velas diarias (smaSteps)
  benchmark: string
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [interval, setTimeframe] = useState<Interval>("1mo")
  const [state, setState] = useState<State>({ status: "loading" })

  function pick(next: Interval) {
    if (next === interval) return
    setTimeframe(next)
    setState({ status: "loading" })
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/invest/bars?${new URLSearchParams({ ticker, interval })}`)
        const json = await res.json() as InvestBarsResponse
        if (!cancelled) setState(json.ok ? { status: "ready", bars: json.bars } : { status: "error" })
      } catch {
        if (!cancelled) setState({ status: "error" })
      }
    })()
    return () => { cancelled = true }
  }, [ticker, interval])

  useEffect(() => {
    if (!containerRef.current || state.status !== "ready") return
    const { bars } = state
    const profit = cssColor("--color-profit", "#22c55e")
    const loss = cssColor("--color-loss", "#ef4444")
    const accent = cssColor("--color-accent", "#a3e635")

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: cssColor("--color-text-mute", "#6b7280"),
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: 11,
      },
      grid: { vertLines: { color: "#1a1a26" }, horzLines: { color: "#1a1a26" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1e1e2e" },
      timeScale: { borderColor: "#1e1e2e", fixLeftEdge: true, fixRightEdge: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })

    const candles = chart.addCandlestickSeries({
      upColor: profit, downColor: loss, borderVisible: false, wickUpColor: profit, wickDownColor: loss,
      priceLineVisible: true, lastValueVisible: true,
    })
    candles.setData(bars)

    const sma = chart.addLineSeries({
      color: accent, lineWidth: 2, lineType: interval === "1d" ? LineType.WithSteps : LineType.Simple,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    })
    const smaData = interval === "1d"
      ? stepsInRange(steps, bars[0]!.time, bars.at(-1)!.time)
      : series.filter(p => p.sma10 != null).map(p => ({ time: `${p.month}-01`, value: p.sma10! }))
        .filter(p => p.time >= bars[0]!.time && p.time <= bars.at(-1)!.time)
    sma.setData(smaData)

    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [state, interval, series, steps])

  const last = series.at(-1)
  const first = series[0]
  const stretch = last?.sma10 ? last.close / last.sma10 - 1 : null
  const rel = series.filter(p => p.relative != null)

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 border-b border-border">
        {last && (
          <div className="flex items-baseline gap-2.5">
            <span className="mono text-2xl font-semibold text-text leading-none">{fmt(last.close)}</span>
            {currency && <span className="mono text-xs text-text-mute">{currency}</span>}
            <span className="mono text-xs text-text-mute">{D.CLOSE_OF.replace("{date}", fmtDay(last.monthEnd))}</span>
            {first && first !== last && (
              <span className={cn("mono text-sm", last.close >= first.close ? "text-profit" : "text-loss")}>
                {D.CHANGE.replace("{pct}", pct(last.close / first.close - 1)).replace("{n}", String(series.length))}
              </span>
            )}
          </div>
        )}
        {stretch != null && last?.sma10 && (
          <span className="text-sm text-text-dim">
            {D.VS_SMA}{" "}
            <span className={cn("mono font-semibold", stretch < 0 ? "text-loss" : stretch > 0.3 ? "text-short" : "text-text")}>{pct(stretch)}</span>
            {" · "}{D.EXIT_BELOW}{" "}<span className="mono text-text">{fmt(last.sma10)}</span>
          </span>
        )}
        <div className="ml-auto inline-flex items-center rounded-md border border-border overflow-hidden" role="group" aria-label={D.TIMEFRAME}>
          {(["1mo", "1d"] as const).map((k, i) => (
            <button
              key={k} type="button" onClick={() => pick(k)} aria-pressed={interval === k}
              className={cn(
                "px-3 py-1.5 text-sm whitespace-nowrap cursor-pointer border-t",
                i > 0 && "border-l border-l-border",
                interval === k ? "bg-surface-2 text-text border-t-accent" : "text-text-mute border-t-transparent hover:text-text-dim",
              )}
            >
              {k === "1mo" ? D.TF_MONTHLY : D.TF_DAILY}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 text-xs text-text-dim">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-profit" />{D.LEGEND_UP}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-loss" />{D.LEGEND_DOWN}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-accent" />{D.LEGEND_SMA}</span>
      </div>

      <div className="px-2 pt-2">
        {state.status === "ready" ? (
          <div ref={containerRef} style={{ height: HEIGHT }} />
        ) : (
          <div className="flex items-center justify-center text-sm text-text-mute" style={{ height: HEIGHT }}>
            {state.status === "loading" ? D.CHART_LOADING : D.CHART_ERROR}
          </div>
        )}
      </div>

      {rel.length > 1 && <RelativeStrip points={rel} label={D.LEGEND_RELATIVE.replace("{benchmark}", benchmark)} />}
    </div>
  )
}

/** Franja del precio relativo al benchmark (100 = primer mes). */
function RelativeStrip({ points, label }: { points: PricePoint[]; label: string }): ReactElement {
  const W = 1000, H = 64
  const values = points.map(p => p.relative!)
  const lo = Math.min(...values, 100), hi = Math.max(...values, 100)
  const span = hi - lo || 1
  const y = (v: number) => H - 4 - ((v - lo) / span) * (H - 8)
  const xy = points.map((p, i) => [(i / (points.length - 1)) * W, y(p.relative!)] as [number, number])
  const lastRel = values.at(-1)!
  return (
    <div className="px-4 pt-2 pb-3 border-t border-border mt-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="label-caps">{label}</span>
        <span className={cn("mono text-xs ml-auto", lastRel >= 100 ? "text-long" : "text-loss")}>{Math.round(lastRel)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} role="img" aria-label={label}>
        <line x1={0} x2={W} y1={y(100)} y2={y(100)} stroke="var(--color-border-hi)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <path d={smoothD(xy)} fill="none" stroke="var(--color-long)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
