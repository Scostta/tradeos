"use client"

import { useTransition, useRef, useState } from "react"
import type { ReactElement } from "react"
import { formatDuration } from "~/helpers/duration"
import { updateTradeStopPrice } from "~/actions/trades"
import { useStopPrice } from "./stop-price-context.client"
import { useTimezone } from "~/hooks/use-timezone"
import { TRADES } from "~/constants/copies/trades"
import type { Trade } from "~/types/trade"

const X = TRADES.EXECUTIONS

// ── MAE-based stop estimate ────────────────────────────────────────────────────
const POINT_VALUES: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5 }

function estimatedStop(trade: Trade): number | null {
  if (!trade.mae || trade.mae === 0) return null
  const pv  = (POINT_VALUES[trade.instrument.replace(/\s.*/, "").toUpperCase()] ?? 1) * trade.contracts
  const dir = trade.direction === "long" ? 1 : -1
  return trade.entryPrice - dir * (Math.abs(trade.mae) / pv) * 1.15
}

export function TradeExecutionsCard({ trade }: { trade: Trade }): ReactElement {
  const isLong   = trade.direction === "long"
  const isProfit = trade.netPnl >= 0

  const { stopPrice, setStopPrice } = useStopPrice()
  const [editing,   setEditing]     = useState(false)
  const [draft,     setDraft]       = useState("")
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const timeZone = useTimezone()

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone,
    })

  const movePts  = ((trade.exitPrice - trade.entryPrice) * (isLong ? 1 : -1)).toFixed(2)
  const moveSign = Number(movePts) >= 0 ? "+" : ""
  const estimate = estimatedStop(trade)

  function startEdit() {
    setDraft(stopPrice?.toFixed(2) ?? estimate?.toFixed(2) ?? "")
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    const parsed = parseFloat(draft.replace(",", "."))
    const next   = isNaN(parsed) || parsed <= 0 ? null : parsed
    setEditing(false)
    if (next === stopPrice) return
    setStopPrice(next)
    startTransition(async () => {
      await updateTradeStopPrice({ id: trade.id, stopPrice: next })
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter")  { e.preventDefault(); commitEdit() }
    if (e.key === "Escape") { setEditing(false) }
  }

  const displayStop = stopPrice ?? estimate
  const isEstimate  = stopPrice === null && estimate !== null

  return (
    <div className="card p-4">
      <div className="label-caps mb-3">{X.TITLE}</div>

      <div className="flex flex-col gap-1">
        {/* Entry */}
        <div className="flex items-center gap-2 bg-surface-2 rounded-sm px-3 py-2.5">
          <span className="mono text-xxs font-semibold shrink-0" style={{ color: "#3b82f6", minWidth: 34 }}>
            {X.ENTRY}
          </span>
          <span className="mono text-xxs text-text-mute flex-1">{fmtTime(trade.entryTime)}</span>
          <span
            className="mono text-xxs font-semibold px-1.5 py-px rounded-xs shrink-0"
            style={{
              background: isLong ? "rgba(59,130,246,.15)" : "rgba(245,158,11,.15)",
              color:      isLong ? "var(--color-long)"    : "var(--color-short)",
              border:     `1px solid ${isLong ? "rgba(59,130,246,.3)" : "rgba(245,158,11,.3)"}`,
            }}
          >
            {isLong ? X.LONG : X.SHORT}
          </span>
          <span className="mono text-sm font-semibold text-text shrink-0">
            {trade.entryPrice.toFixed(2)}
          </span>
          <span className="mono text-xxs text-text-mute shrink-0">{trade.contracts}×</span>
        </div>

        {/* Exit */}
        <div className="flex items-center gap-2 bg-surface-2 rounded-sm px-3 py-2.5">
          <span
            className="mono text-xxs font-semibold shrink-0"
            style={{ color: isProfit ? "var(--color-profit)" : "var(--color-loss)", minWidth: 34 }}
          >
            {X.EXIT}
          </span>
          <span className="mono text-xxs text-text-mute flex-1">{fmtTime(trade.exitTime)}</span>
          <span className="mono text-xxs shrink-0" style={{ color: isProfit ? "var(--color-profit)" : "var(--color-loss)" }}>
            {moveSign}{movePts} {X.PTS}
          </span>
          <span className="mono text-sm font-semibold text-text shrink-0">
            {trade.exitPrice.toFixed(2)}
          </span>
          <span className="mono text-xxs text-text-mute shrink-0">{trade.contracts}×</span>
        </div>

        {/* Stop — editable */}
        <div
          className="flex items-center gap-2 bg-surface-2 rounded-sm px-3 py-2.5 cursor-pointer group"
          onClick={!editing ? startEdit : undefined}
          title={isEstimate ? X.TITLE_EST : X.TITLE_EDIT}
        >
          <span className="mono text-xxs font-semibold shrink-0 text-loss" style={{ minWidth: 34 }}>
            {X.STOP}
          </span>

          <span className="flex-1" />

          {isEstimate && !editing && (
            <span className="text-xxs text-text-mute italic">{X.EST}</span>
          )}

          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              autoFocus
              className="mono text-sm font-semibold text-loss bg-transparent outline-none border-b border-loss w-24 text-right"
              style={{ minWidth: 0 }}
            />
          ) : (
            <span
              className="mono text-sm font-semibold shrink-0"
              style={{
                color:   displayStop ? "var(--color-loss)" : "var(--color-text-mute)",
                opacity: isEstimate ? 0.6 : 1,
              }}
            >
              {displayStop ? displayStop.toFixed(2) : X.SET_STOP}
            </span>
          )}

          {/* Edit icon */}
          {!editing && (
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className="shrink-0 text-text-mute opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          )}

          {/* Clear button when stop is defined */}
          {stopPrice !== null && !editing && (
            <button
              onClick={e => {
                e.stopPropagation()
                setStopPrice(null)
                startTransition(async () => { await updateTradeStopPrice({ id: trade.id, stopPrice: null }) })
              }}
              disabled={isPending}
              className="shrink-0 text-text-mute hover:text-loss transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Hold time */}
        <div className="flex items-center justify-between mt-1 px-1">
          <span className="text-xxs text-text-mute">{X.HOLD_TIME}</span>
          <span className="mono text-xs text-text-dim">{formatDuration(trade.entryTime, trade.exitTime)}</span>
        </div>
      </div>
    </div>
  )
}
