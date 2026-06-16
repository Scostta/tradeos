"use client"

import { useEffect, useRef } from "react"
import type { ReactElement } from "react"
import type { PlaybookWithStats } from "~/types/playbook"
import { PLAYBOOKS } from "~/constants/copies/playbooks"
import { formatDate, formatCurrency, formatPct } from "~/helpers/format"
import { PlaybookEditor } from "./playbook-editor.client"

type Props = { playbook: PlaybookWithStats }

function MiniEquitySpark({ points, gradientId }: { points: number[]; gradientId: string }): ReactElement {
  const lineRef = useRef<SVGPathElement>(null)
  const areaRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const line = lineRef.current
    if (!line) return
    const len = line.getTotalLength()

    line.style.transition       = "none"
    line.style.strokeDasharray  = `${len}`
    line.style.strokeDashoffset = `${len}`
    if (areaRef.current) {
      areaRef.current.style.transition = "none"
      areaRef.current.style.opacity    = "0"
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        line.style.transition       = "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)"
        line.style.strokeDashoffset = "0"
        if (areaRef.current) {
          areaRef.current.style.transition = "opacity 1s ease 0.1s"
          areaRef.current.style.opacity    = "1"
        }
      })
    })
  }, [points])

  if (points.length < 2) return <div style={{ height: 32 }} />

  const W = 320, H = 32
  const min   = Math.min(0, ...points)
  const max   = Math.max(0, ...points)
  const range = max - min || 1
  const x     = (i: number) => (i / (points.length - 1)) * W
  const y     = (v: number) => H - ((v - min) / range) * H
  const path  = points.map((p, i) => `${x(i)},${y(p)}`).join(" L")

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--color-accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0"   />
        </linearGradient>
      </defs>
      <path
        ref={areaRef}
        d={`M${path} L${W},${H} L0,${H} Z`}
        fill={`url(#${gradientId})`}
      />
      <path
        ref={lineRef}
        d={`M${path}`}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.2"
      />
    </svg>
  )
}

export function PlaybookCard({ playbook }: Props): ReactElement {
  const hasData         = playbook.tradeCount > 0
  const winRatePositive = playbook.winRate > 0.5
  const pnlPositive     = playbook.netPnl >= 0
  const hasR            = playbook.rCoverage.withR > 0
  const hasAvgWL        = hasData && playbook.avgLoss !== 0
  const avgWL           = hasAvgWL ? playbook.avgWin / Math.abs(playbook.avgLoss) : 0
  const fmtR            = (r: number): string => `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(2)}R`

  return (
    <PlaybookEditor
      mode="edit"
      playbook={playbook}
      renderTrigger={(open) => (
        <div
          role="button"
          onClick={open}
          className="card p-5 flex flex-col gap-4 cursor-pointer transition-colors hover:border-border-hi"
          style={{ minHeight: 192 }}
        >
          {/* Top row: name + status badge */}
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-semibold text-text truncate flex-1">{playbook.name}</p>
            <span
              className="text-xs font-medium mono tracking-wider px-2 py-0.5 rounded-sm border shrink-0"
              style={
                playbook.active
                  ? {
                      color:      "var(--color-profit)",
                      background: "rgba(34,197,94,0.1)",
                      border:     "1px solid rgba(34,197,94,0.3)",
                    }
                  : {
                      color:      "var(--color-text-mute)",
                      background: "var(--color-surface-2)",
                      border:     "1px solid var(--color-border)",
                    }
              }
            >
              {playbook.active ? PLAYBOOKS.CARD.STATUS_ACTIVE : PLAYBOOKS.CARD.STATUS_ARCHIVED}
            </span>
          </div>

          {/* Created meta */}
          <p className="mono text-xs text-text-mute -mt-2">
            {PLAYBOOKS.CARD.CREATED_PREFIX} {formatDate(playbook.createdAt)}
          </p>

          {/* Description */}
          <p className="text-sm text-text-mute line-clamp-2">
            {playbook.description ?? (
              <span className="italic">{PLAYBOOKS.CARD.NO_DESCRIPTION}</span>
            )}
          </p>

          {/* Equity sparkline */}
          <MiniEquitySpark points={playbook.equityCurve} gradientId={`msp-${playbook.id}`} />

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-px bg-border rounded-sm border border-border overflow-hidden">
            <div className="bg-surface p-3">
              <div className="label-caps mb-1">{PLAYBOOKS.CARD.TRADES_LABEL}</div>
              <div className="mono text-lg font-semibold text-text">{playbook.tradeCount}</div>
            </div>

            <div className="bg-surface p-3">
              <div className="label-caps mb-1">{PLAYBOOKS.CARD.WIN_RATE_LABEL}</div>
              {hasData ? (
                <div
                  className="mono text-lg font-semibold"
                  style={{ color: winRatePositive ? "var(--color-accent)" : "var(--color-text)" }}
                >
                  {formatPct(playbook.winRate, 0)}
                </div>
              ) : (
                <div className="mono text-lg font-semibold text-text-mute">—</div>
              )}
            </div>

            <div className="bg-surface p-3">
              <div className="label-caps mb-1">{PLAYBOOKS.CARD.NET_PNL_LABEL}</div>
              {hasData ? (
                <div
                  className="mono text-lg font-semibold"
                  style={{ color: pnlPositive ? "var(--color-profit)" : "var(--color-loss)" }}
                >
                  {formatCurrency(playbook.netPnl)}
                </div>
              ) : (
                <div className="mono text-lg font-semibold text-text-mute">—</div>
              )}
            </div>
          </div>

          {/* Stats strip — risk-based (playbook attribution) */}
          <div className="grid grid-cols-3 gap-px bg-border rounded-sm border border-border overflow-hidden">
            <div className="bg-surface p-3">
              <div className="label-caps mb-1">{PLAYBOOKS.CARD.EXPECTANCY_R}</div>
              {hasR ? (
                <div
                  className="mono text-lg font-semibold"
                  style={{ color: playbook.expectancyR >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
                >
                  {fmtR(playbook.expectancyR)}
                </div>
              ) : (
                <div className="mono text-lg font-semibold text-text-mute">—</div>
              )}
            </div>

            <div className="bg-surface p-3">
              <div className="label-caps mb-1">{PLAYBOOKS.CARD.PROFIT_FACTOR}</div>
              {hasData ? (
                <div
                  className="mono text-lg font-semibold"
                  style={{ color: playbook.profitFactor >= 1 ? "var(--color-profit)" : "var(--color-loss)" }}
                >
                  {playbook.profitFactor.toFixed(2)}
                </div>
              ) : (
                <div className="mono text-lg font-semibold text-text-mute">—</div>
              )}
            </div>

            <div className="bg-surface p-3">
              <div className="label-caps mb-1">{PLAYBOOKS.CARD.AVG_WL}</div>
              {hasAvgWL ? (
                <div className="mono text-lg font-semibold text-text">{avgWL.toFixed(2)}</div>
              ) : (
                <div className="mono text-lg font-semibold text-text-mute">—</div>
              )}
            </div>
          </div>
        </div>
      )}
    />
  )
}
