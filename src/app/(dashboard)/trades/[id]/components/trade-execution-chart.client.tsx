"use client"

import { useEffect, useRef, useState } from "react"
import {
  createChart,
  CrosshairMode,
  LineStyle,
  ColorType,
} from "lightweight-charts"
import type { IChartApi, UTCTimestamp } from "lightweight-charts"
import { TRADES } from "~/constants/copies/trades"
import type { Trade } from "~/types/trade"
import type { PolygonBar, PolygonBarsResponse } from "~/app/api/polygon/bars/route"

const C = TRADES.CHART
const CHART_TYPE_LABELS = { candles: C.TYPE_CANDLES, line: C.TYPE_LINE, bars: C.TYPE_BARS } as const

// ── Constants ─────────────────────────────────────────────────────────────────
const POINT_VALUES: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5 }

function getPointValue(instrument: string): number {
  return POINT_VALUES[instrument.replace(/\s.*/, "").toUpperCase()] ?? 1
}

// ── Synthetic fallback ────────────────────────────────────────────────────────
function makePrng(seed: number): () => number {
  let s = seed
  return () => { s = ((s * 1103515245 + 12345) & 0x7fffffff); return s / 0x7fffffff }
}

type Bar = { time: UTCTimestamp; open: number; high: number; low: number; close: number }
type VolBar = { time: UTCTimestamp; value: number; color: string }

function generateSyntheticBars(trade: Trade): { bars: Bar[]; volume: VolBar[] } {
  const PRE = 20, POST = 20
  const entryMs = new Date(trade.entryTime).getTime()
  const exitMs = new Date(trade.exitTime).getTime()
  const holdMin = Math.max(3, Math.round((exitMs - entryMs) / 60000))
  const N = PRE + holdMin + POST
  const pv = getPointValue(trade.instrument) * trade.contracts
  const maePts = trade.mae !== null ? Math.abs(trade.mae) / pv : 2
  const dirMul = trade.direction === "long" ? 1 : -1
  const exitOffset = (trade.exitPrice - trade.entryPrice) * dirMul
  const seed = parseInt(trade.id.replace(/-/g, "").slice(0, 8), 16) || 42
  const rng = makePrng(seed)
  const baseTime = Math.floor(entryMs / 1000) - PRE * 60
  const bars: Bar[] = []
  const volume: VolBar[] = []
  let lastClose = trade.entryPrice - dirMul * 1.5

  for (let i = 0; i < N; i++) {
    let target: number
    if (i < PRE) target = trade.entryPrice + (rng() - 0.5) * 3
    else if (i < PRE + holdMin * 0.35) target = trade.entryPrice - dirMul * maePts * ((i - PRE) / Math.max(1, holdMin * 0.35))
    else if (i < PRE + holdMin) target = trade.entryPrice + dirMul * (-maePts + (exitOffset + maePts) * ((i - PRE - holdMin * 0.35) / Math.max(1, holdMin * 0.65)))
    else target = trade.exitPrice + (rng() - 0.5) * 2

    const close = target + (rng() - 0.5) * 1.4
    const open = lastClose
    const isUp = close >= open
    const bt = (baseTime + i * 60) as UTCTimestamp

    bars.push({ time: bt, open, high: Math.max(open, close) + rng() * 1.2, low: Math.min(open, close) - rng() * 1.2, close })
    const bv = 200 + rng() * 600
    volume.push({ time: bt, value: Math.round((i === PRE || i === PRE + holdMin) ? bv * 3.5 : bv * (1 + rng())), color: isUp ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)" })
    lastClose = close
  }
  return { bars, volume }
}

// ── Convert Polygon bars → chart bars ────────────────────────────────────────
function polygonToChartBars(pBars: PolygonBar[]): { bars: Bar[]; volume: VolBar[] } {
  const bars: Bar[] = []
  const volume: VolBar[] = []
  for (const b of pBars) {
    const isUp = b.close >= b.open
    bars.push({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close })
    volume.push({ time: b.time as UTCTimestamp, value: b.volume, color: isUp ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)" })
  }
  return { bars, volume }
}

// ── Find the best bar for an entry/exit price ─────────────────────────────────
// Priority 1: bars whose OHLC range contains the target price → pick closest in time
// Priority 2: bar with closest price midpoint to target → pick closest in time
// This is timezone-agnostic: price match always wins over time proximity.
function bestBar(bars: Bar[], targetSec: number, targetPrice: number): Bar {
  // Bars whose [low, high] bracket the exact target price
  const containing = bars.filter(b => targetPrice >= b.low && targetPrice <= b.high)

  if (containing.length) {
    return containing.reduce((best, b) =>
      Math.abs(b.time - targetSec) < Math.abs(best.time - targetSec) ? b : best
    )
  }

  // Nothing contains the price exactly — pick the bar whose midpoint is closest
  // to the target price, then break ties by time
  return bars.reduce((best, b) => {
    const bMid    = (b.high + b.low) / 2
    const bestMid = (best.high + best.low) / 2
    const bDist   = Math.abs(bMid - targetPrice)
    const bestDist = Math.abs(bestMid - targetPrice)
    if (bDist !== bestDist) return bDist < bestDist ? b : best
    return Math.abs(b.time - targetSec) < Math.abs(best.time - targetSec) ? b : best
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ChartType = "candles" | "line" | "bars"
type DataSource = "real" | "synthetic"

type ChartState =
  | { status: "loading" }
  | { status: "ready"; bars: Bar[]; volume: VolBar[]; source: DataSource; label?: string }

// ── Main component ────────────────────────────────────────────────────────────
export function TradeExecutionChart({ trade }: { trade: Trade }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  const [chartType, setChartType] = useState<ChartType>("candles")
  const [state, setState] = useState<ChartState>({ status: "loading" })
  const [retryCount, setRetryCount] = useState(0)

  const isProfit = trade.netPnl >= 0
  const exitColor = isProfit ? "#22c55e" : "#ef4444"
  const s = trade.instrument.replace(/\s.*/, "").toUpperCase()
  const movePts = ((trade.exitPrice - trade.entryPrice) * (trade.direction === "long" ? 1 : -1)).toFixed(2)
  const pnlColor = isProfit ? "var(--color-profit)" : "var(--color-loss)"

  // ── Fetch data — never calls setState synchronously on effect entry ──────────
  useEffect(() => {
    let cancelled = false

      ; (async () => {
        try {
          const params = new URLSearchParams({
            instrument: trade.instrument,
            from: trade.entryTime,
            to: trade.exitTime,
          })
          const res = await fetch(`/api/polygon/bars?${params}`)
          const json = await res.json() as PolygonBarsResponse

          if (cancelled) return

          if (json.ok && json.bars.length >= 2) {
            setState({ status: "ready", ...polygonToChartBars(json.bars), source: "real", label: json.source })
          } else {
            setState({ status: "ready", ...generateSyntheticBars(trade), source: "synthetic" })
          }
        } catch {
          if (!cancelled)
            setState({ status: "ready", ...generateSyntheticBars(trade), source: "synthetic" })
        }
      })()

    return () => { cancelled = true }
  }, [trade, retryCount])

  // ── Build / rebuild chart when data or type changes ─────────────────────────
  useEffect(() => {
    if (!containerRef.current || state.status !== "ready") return
    const { bars, volume } = state

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#111118" },
        textColor: "#6b7280",
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1a1a26", style: LineStyle.Solid },
        horzLines: { color: "#1a1a26", style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#2a2a3d", width: 1, labelBackgroundColor: "#15151f" },
        horzLine: { color: "#2a2a3d", width: 1, labelBackgroundColor: "#15151f" },
      },
      rightPriceScale: {
        borderColor: "#1e1e2e",
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#1e1e2e",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })
    chartRef.current = chart

    // ── Price series ──────────────────────────────────────────────────────────
    let priceSeries: ReturnType<typeof chart.addCandlestickSeries>

    if (chartType === "candles") {
      priceSeries = chart.addCandlestickSeries({ upColor: "#22c55e", downColor: "#ef4444", borderVisible: false, wickUpColor: "#22c55e", wickDownColor: "#ef4444" })
      priceSeries.setData(bars)
    } else if (chartType === "bars") {
      const bs = chart.addBarSeries({ upColor: "#22c55e", downColor: "#ef4444" })
      bs.setData(bars)
      // @ts-expect-error — shared API surface
      priceSeries = bs
    } else {
      const ls = chart.addLineSeries({ color: exitColor, lineWidth: 2 })
      ls.setData(bars.map(b => ({ time: b.time, value: b.close })))
      // @ts-expect-error — shared API surface
      priceSeries = ls
    }

    // ── Volume ────────────────────────────────────────────────────────────────
    const volSeries = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" })
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
    volSeries.setData(volume)

    // ── Price lines ───────────────────────────────────────────────────────────
    priceSeries.createPriceLine({ price: trade.entryPrice, color: "#3b82f6", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "ENTRY" })
    priceSeries.createPriceLine({ price: trade.exitPrice, color: exitColor, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "EXIT" })

    {
      const stopPrice = (() => {
        if (trade.stopPrice != null) return trade.stopPrice
        if (trade.mae !== null && trade.mae !== 0) {
          const pv  = getPointValue(trade.instrument) * trade.contracts
          const dir = trade.direction === "long" ? 1 : -1
          return trade.entryPrice - dir * (Math.abs(trade.mae) / pv) * 1.15
        }
        return null
      })()
      if (stopPrice !== null) {
        const isEstimate = trade.stopPrice == null
        priceSeries.createPriceLine({
          price:            stopPrice,
          color:            isEstimate ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.85)",
          lineWidth:        1,
          lineStyle:        isEstimate ? LineStyle.Dotted : LineStyle.Dashed,
          axisLabelVisible: true,
          title:            isEstimate ? "STOP (est.)" : "STOP",
        })
      }
    }
    if (trade.mfe !== null && trade.mfe !== 0) {
      const pv = getPointValue(trade.instrument) * trade.contracts
      const dir = trade.direction === "long" ? 1 : -1
      priceSeries.createPriceLine({ price: trade.entryPrice + dir * (Math.abs(trade.mfe) / pv) * 1.05, color: "rgba(163,230,53,0.7)", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "TARGET" })
    }

    // ── Entry / exit markers ──────────────────────────────────────────────────
    const entrySec = Math.floor(new Date(trade.entryTime).getTime() / 1000)
    const exitSec = Math.floor(new Date(trade.exitTime).getTime() / 1000)
    const eBar = bestBar(bars, entrySec, trade.entryPrice)
    const xBar = bestBar(bars, exitSec,  trade.exitPrice)

    priceSeries.setMarkers([
      { time: eBar.time, position: "belowBar", color: "#3b82f6", shape: "arrowUp", text: `▲ ${trade.entryPrice.toFixed(2)}`, size: 1 },
      { time: xBar.time, position: "aboveBar", color: exitColor, shape: "arrowDown", text: `▼ ${trade.exitPrice.toFixed(2)}`, size: 1 },
    ])

    chart.timeScale().fitContent()
    return () => { chart.remove(); chartRef.current = null }
  }, [state, chartType, trade, exitColor])

  return (
    <div className="card overflow-hidden flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 md:px-4 py-1.5 md:py-0 border-b border-border shrink-0"
        style={{ minHeight: 36 }}
      >
        <span className="mono text-sm font-semibold text-text">{s}</span>
        <span className="text-border-hi select-none hidden sm:inline">|</span>
        <span className="mono text-xs text-text-dim hidden md:inline">{C.TIMEFRAME}</span>

        <div className="flex items-center gap-2 mono text-xs">
          <span className="hidden sm:inline" style={{ color: "#3b82f6" }}>{C.OPEN} {trade.entryPrice.toFixed(2)}</span>
          <span style={{ color: pnlColor }}>{isProfit ? "+" : ""}{movePts} {C.PTS}</span>
          <span className="font-semibold" style={{ color: pnlColor }}>
            {isProfit ? `+$${trade.netPnl.toFixed(2)}` : `−$${Math.abs(trade.netPnl).toFixed(2)}`}
          </span>
        </div>

        <div className="flex-1" />

        {/* Data source badge */}
        {state.status === "ready" && (
          <div className="hidden sm:flex items-center gap-1.5">
            <span
              className="mono text-xxs px-1.5 py-px rounded-xs"
              style={{
                background: state.source === "real" ? "rgba(163,230,53,.12)" : "rgba(107,114,128,.12)",
                color: state.source === "real" ? "var(--color-accent)" : "var(--color-text-mute)",
                border: `1px solid ${state.source === "real" ? "rgba(163,230,53,.25)" : "rgba(107,114,128,.25)"}`,
              }}
            >
              {state.source === "real" ? (state.label ?? C.SOURCE_REAL) : C.SOURCE_SYNTHETIC}
            </span>
            {state.source === "synthetic" && (
              <button
                onClick={() => { setState({ status: "loading" }); setRetryCount(c => c + 1) }}
                className="mono text-xxs text-text-mute hover:text-text-dim transition-colors"
                title={C.RETRY}
              >
                ↺
              </button>
            )}
          </div>
        )}

        {/* Chart type toggle */}
        <div className="flex items-center gap-1">
          {(["candles", "line", "bars"] as ChartType[]).map(t => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className="px-2 py-0.5 rounded-xs text-xxs capitalize transition-colors"
              style={{
                background: chartType === t ? "var(--color-surface-2)" : "transparent",
                color: chartType === t ? "var(--color-text)" : "var(--color-text-mute)",
                border: `1px solid ${chartType === t ? "var(--color-border-hi)" : "var(--color-border)"}`,
                cursor: "pointer",
              }}
            >
              {CHART_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-2 mono text-xxs">
          <span style={{ color: "#3b82f6" }}>● {C.LEGEND_ENTRY}</span>
          <span style={{ color: exitColor }}>● {C.LEGEND_EXIT}</span>
          <span className="text-loss">┄ {C.LEGEND_STOP}</span>
          <span className="text-accent">┄ {C.LEGEND_TARGET}</span>
        </div>
      </div>

      {/* Chart — fills the remaining height so it grows with the sidebar */}
      <div className="relative flex-1 min-h-0" style={{ minHeight: 560 }}>
        {state.status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-xxs text-text-mute bg-surface z-10">
            {C.LOADING}
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  )
}
