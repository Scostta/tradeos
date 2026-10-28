"use client"

import { useEffect, useRef, useState } from "react"
import type { ReactElement } from "react"
import { ColorType, CrosshairMode, LineStyle, LineType, createChart } from "lightweight-charts"
import { INVEST } from "~/constants/copies/invest"
import { stepsInRange } from "~/lib/calculations/invest-position-chart"
import type { StepPoint } from "~/lib/calculations/invest-position-chart"
import type { InvestBar, InvestBarsResponse } from "~/app/api/invest/bars/route"
import { fmtDay } from "../../../components/invest-format"

const D = INVEST.POSITION
const ENTRY_COLOR = "#3b82f6"   // mismo azul que la entrada en el chart de trades

type State = { status: "loading" } | { status: "error" } | { status: "ready"; bars: InvestBar[] }

// Color del P&L neto realizado, con la misma regla que signColor.
export type PnlTone = "profit" | "loss" | "neutral"
const TONE_VAR: Record<PnlTone, [string, string]> = {
  profit:  ["--color-profit", "#22c55e"],
  loss:    ["--color-loss", "#ef4444"],
  neutral: ["--color-text-dim", "#9ca3af"],
}

type Props = {
  ticker:     string
  entryPrice: number
  openedAt:   string
  steps:      StepPoint[]     // SMA 10 mensual (smaSteps), sobre adj_close
  exitLevel:  number | null   // solo posiciones abiertas con los 9 meses previos
  exit:       { price: number; date: string; tone: PnlTone } | null   // solo cerradas
}

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

// §4.3: velas diarias de 18 meses (ajustadas), línea de entrada con su fecha,
// SMA 10 mensual escalonada y, en abiertas, el nivel de salida del próximo
// cierre; en cerradas, el precio de salida con su fecha. Nada más.
export function PositionChart({ ticker, entryPrice, openedAt, steps, exitLevel, exit }: Props): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/invest/bars?${new URLSearchParams({ ticker })}`)
        const json = await res.json() as InvestBarsResponse
        if (!cancelled) setState(json.ok ? { status: "ready", bars: json.bars } : { status: "error" })
      } catch {
        if (!cancelled) setState({ status: "error" })
      }
    })()
    return () => { cancelled = true }
  }, [ticker])

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
      grid: {
        vertLines: { color: "#1a1a26" },
        horzLines: { color: "#1a1a26" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1e1e2e" },
      timeScale: { borderColor: "#1e1e2e", fixLeftEdge: true, fixRightEdge: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })

    // Sin la línea ni la etiqueta de último precio de la serie: solo los overlays.
    const candles = chart.addCandlestickSeries({
      upColor: profit, downColor: loss, borderVisible: false, wickUpColor: profit, wickDownColor: loss,
      priceLineVisible: false, lastValueVisible: false,
    })
    candles.setData(bars)

    candles.createPriceLine({
      price: entryPrice, color: ENTRY_COLOR, lineWidth: 1, lineStyle: LineStyle.Dashed,
      axisLabelVisible: true, title: D.ENTRY_LINE.replace("{date}", fmtDay(openedAt)),
    })
    if (exitLevel != null) {
      candles.createPriceLine({
        price: exitLevel, color: loss, lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: D.EXIT_LINE,
      })
    }
    if (exit) {
      candles.createPriceLine({
        price: exit.price, color: cssColor(...TONE_VAR[exit.tone]), lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: D.EXIT_PRICE_LINE.replace("{date}", fmtDay(exit.date)),
      })
    }

    // La SMA solo cambia a fin de mes: escalones dentro de la ventana de velas.
    const sma = chart.addLineSeries({
      color: accent, lineWidth: 2, lineType: LineType.WithSteps,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    })
    sma.setData(stepsInRange(steps, bars[0]!.time, bars.at(-1)!.time))

    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [state, entryPrice, openedAt, steps, exitLevel, exit])

  if (state.status !== "ready") {
    return (
      <div className="flex items-center justify-center text-sm text-text-mute" style={{ height: 360 }}>
        {state.status === "loading" ? D.CHART_LOADING : D.CHART_ERROR}
      </div>
    )
  }
  return <div ref={containerRef} style={{ height: 360 }} />
}
