"use client"

import { useEffect, useRef, useState } from "react"
import {
  createChart,
  CrosshairMode,
  LineStyle,
  ColorType,
} from "lightweight-charts"
import type { IChartApi, UTCTimestamp } from "lightweight-charts"
import type { Trade } from "~/types/trade"

const POINT_VALUES: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5 }

function getPointValue(instrument: string): number {
  const s = instrument.replace(/\s.*/, "").toUpperCase()
  return POINT_VALUES[s] ?? 1
}

function makePrng(seed: number): () => number {
  let s = seed
  return () => {
    s = ((s * 1103515245 + 12345) & 0x7fffffff)
    return s / 0x7fffffff
  }
}

type Bar = { time: UTCTimestamp; open: number; high: number; low: number; close: number }
type VolBar = { time: UTCTimestamp; value: number; color: string }

function generateBars(trade: Trade): { bars: Bar[]; volume: VolBar[]; entryTime: UTCTimestamp; exitTime: UTCTimestamp } {
  const PRE  = 20
  const POST = 20

  const entryMs = new Date(trade.entryTime).getTime()
  const exitMs  = new Date(trade.exitTime).getTime()
  const holdMin = Math.max(3, Math.round((exitMs - entryMs) / 60000))
  const N       = PRE + holdMin + POST

  const pv         = getPointValue(trade.instrument) * trade.contracts
  const maePts     = trade.mae !== null ? Math.abs(trade.mae) / pv : 2
  const mfePts     = trade.mfe !== null ? Math.abs(trade.mfe) / pv : 4
  const dirMul     = trade.direction === "long" ? 1 : -1
  const exitOffset = (trade.exitPrice - trade.entryPrice) * dirMul

  const seed = parseInt(trade.id.replace(/-/g, "").slice(0, 8), 16) || 42
  const rng  = makePrng(seed)

  const baseTime = Math.floor(entryMs / 1000) - PRE * 60
  const bars: Bar[] = []
  const volume: VolBar[] = []
  let lastClose = trade.entryPrice - dirMul * 1.5

  for (let i = 0; i < N; i++) {
    const entryIdx = PRE
    const exitIdx  = PRE + holdMin
    let target: number

    if (i < entryIdx) {
      target = trade.entryPrice + (rng() - 0.5) * 3
    } else if (i < entryIdx + holdMin * 0.35) {
      const phase = (i - entryIdx) / Math.max(1, holdMin * 0.35)
      target = trade.entryPrice - dirMul * maePts * phase
    } else if (i < exitIdx) {
      const phase = (i - entryIdx - holdMin * 0.35) / Math.max(1, holdMin * 0.65)
      target = trade.entryPrice + dirMul * (-maePts + (exitOffset + maePts) * phase)
    } else {
      target = trade.exitPrice + (rng() - 0.5) * 2
    }

    const noise = (rng() - 0.5) * 1.4
    const close = target + noise
    const open  = lastClose
    const hi    = Math.max(open, close) + rng() * 1.2
    const lo    = Math.min(open, close) - rng() * 1.2
    const isUp  = close >= open

    const barTime = (baseTime + i * 60) as UTCTimestamp
    bars.push({ time: barTime, open, high: hi, low: lo, close })

    // Volume: higher at entry/exit, moderate otherwise
    const isEntryBar = i === PRE
    const isExitBar  = i === PRE + holdMin
    const baseVol    = 200 + rng() * 600
    const vol        = isEntryBar || isExitBar ? baseVol * 3.5 : baseVol * (1 + rng())

    volume.push({
      time:  barTime,
      value: Math.round(vol),
      color: isUp ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)",
    })

    lastClose = close
  }

  const entryBar = bars[PRE]!
  const exitBar  = bars[PRE + holdMin] ?? bars[bars.length - 1]!

  return { bars, volume, entryTime: entryBar.time, exitTime: exitBar.time }
}

type ChartType = "candles" | "line" | "bars"

export function TradeTestChart({ trade }: { trade: Trade }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const [chartType, setChartType] = useState<ChartType>("candles")

  useEffect(() => {
    if (!containerRef.current) return

    const isProfit  = trade.netPnl >= 0
    const exitColor = isProfit ? "#22c55e" : "#ef4444"

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0f" },
        textColor:  "#6b7280",
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize:   11,
      },
      grid: {
        vertLines: { color: "#1a1a26", style: LineStyle.Solid },
        horzLines: { color: "#1a1a26", style: LineStyle.Solid },
      },
      crosshair: {
        mode:     CrosshairMode.Normal,
        vertLine: { color: "#2a2a3d", width: 1, labelBackgroundColor: "#15151f" },
        horzLine: { color: "#2a2a3d", width: 1, labelBackgroundColor: "#15151f" },
      },
      rightPriceScale: {
        borderColor: "#1e1e2e",
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: {
        borderColor:    "#1e1e2e",
        timeVisible:    true,
        secondsVisible: false,
        fixLeftEdge:    true,
        fixRightEdge:   true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })

    chartRef.current = chart

    // Candle series
    const candleSeries = chart.addCandlestickSeries({
      upColor:       "#22c55e",
      downColor:     "#ef4444",
      borderVisible:  false,
      wickUpColor:    "#22c55e",
      wickDownColor:  "#ef4444",
    })

    // Volume histogram (lower pane via scaleMargins)
    const volumeSeries = chart.addHistogramSeries({
      priceFormat:  { type: "volume" },
      priceScaleId: "vol",
    })
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    const { bars, volume, entryTime, exitTime } = generateBars(trade)
    candleSeries.setData(bars)
    volumeSeries.setData(volume)

    // Price lines
    candleSeries.createPriceLine({
      price: trade.entryPrice, color: "#3b82f6",
      lineWidth: 1, lineStyle: LineStyle.Dashed,
      axisLabelVisible: true, title: "ENTRY",
    })
    candleSeries.createPriceLine({
      price: trade.exitPrice, color: exitColor,
      lineWidth: 1, lineStyle: LineStyle.Dashed,
      axisLabelVisible: true, title: "EXIT",
    })

    if (trade.mae !== null && trade.mae !== 0) {
      const pv    = getPointValue(trade.instrument) * trade.contracts
      const dir   = trade.direction === "long" ? 1 : -1
      const stop  = trade.entryPrice - dir * (Math.abs(trade.mae) / pv) * 1.15
      candleSeries.createPriceLine({
        price: stop, color: "rgba(239,68,68,0.6)",
        lineWidth: 1, lineStyle: LineStyle.Dotted,
        axisLabelVisible: false, title: "STOP",
      })
    }

    if (trade.mfe !== null && trade.mfe !== 0) {
      const pv     = getPointValue(trade.instrument) * trade.contracts
      const dir    = trade.direction === "long" ? 1 : -1
      const target = trade.entryPrice + dir * (Math.abs(trade.mfe) / pv) * 1.05
      candleSeries.createPriceLine({
        price: target, color: "rgba(163,230,53,0.7)",
        lineWidth: 1, lineStyle: LineStyle.Dotted,
        axisLabelVisible: false, title: "TARGET",
      })
    }

    // Markers
    candleSeries.setMarkers([
      {
        time:     entryTime,
        position: "belowBar",
        color:    "#3b82f6",
        shape:    "arrowUp",
        text:     `▲ ${trade.entryPrice.toFixed(2)}`,
        size:     1,
      },
      {
        time:     exitTime,
        position: "aboveBar",
        color:    exitColor,
        shape:    "arrowDown",
        text:     `▼ ${trade.exitPrice.toFixed(2)}`,
        size:     1,
      },
    ])

    chart.timeScale().fitContent()

    return () => {
      chart.remove()
      chartRef.current = null
    }
  }, [trade, chartType])

  const s           = trade.instrument.replace(/\s.*/, "").toUpperCase()
  const isProfit    = trade.netPnl >= 0
  const movePts     = ((trade.exitPrice - trade.entryPrice) * (trade.direction === "long" ? 1 : -1)).toFixed(2)
  const pnlColor    = isProfit ? "var(--color-profit)" : "var(--color-loss)"

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Chart toolbar */}
      <div
        className="flex items-center gap-3 px-4 border-b border-border shrink-0"
        style={{ height: 36, background: "var(--color-surface)" }}
      >
        {/* Instrument + price info */}
        <div className="flex items-center gap-2">
          <span className="mono text-sm font-semibold text-text">{s}</span>
          <span className="text-border-hi">|</span>
          <span className="mono text-xs text-text-dim">1 min</span>
        </div>

        <div className="flex items-center gap-3 mono text-xs">
          <span style={{ color: "#3b82f6" }}>O {trade.entryPrice.toFixed(2)}</span>
          <span style={{ color: pnlColor }}>
            {isProfit ? "+" : ""}{movePts} pts
          </span>
          <span className="mono text-xs font-semibold" style={{ color: pnlColor }}>
            {(isProfit ? "+" : "") + (isProfit
              ? `$${trade.netPnl.toFixed(2)}`
              : `−$${Math.abs(trade.netPnl).toFixed(2)}`
            )}
          </span>
          <span className="text-text-mute">
            ({isProfit ? "+" : ""}{((trade.netPnl / Math.abs(trade.entryPrice * trade.contracts)) * 100).toFixed(2)}%)
          </span>
        </div>

        <div className="flex-1" />

        {/* Chart type toggles */}
        <div className="flex items-center gap-1">
          {(["candles", "line", "bars"] as ChartType[]).map(t => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className="px-2 py-0.5 rounded-xs text-xxs capitalize transition-colors"
              style={{
                background: chartType === t ? "var(--color-surface-2)" : "transparent",
                color:      chartType === t ? "var(--color-text)" : "var(--color-text-mute)",
                border:     `1px solid ${chartType === t ? "var(--color-border-hi)" : "var(--color-border)"}`,
                cursor:     "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mono text-xxs">
          <span style={{ color: "#3b82f6" }}>● Entry</span>
          <span style={{ color: isProfit ? "#22c55e" : "#ef4444" }}>● Exit</span>
          <span className="text-loss">┄ Stop</span>
          <span className="text-accent">┄ Target</span>
        </div>
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="flex-1" style={{ minHeight: 0 }} />
    </div>
  )
}
