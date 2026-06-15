import type { ReactElement } from "react"
import { formatCurrency } from "~/helpers/format"
import { formatDuration } from "~/helpers/duration"
import type { Trade } from "~/types/trade"
import type { Account } from "~/types/account"
import type { Strategy } from "~/types/strategy"

// ── Instrument tick sizes ────────────────────────────────────────────────────
const TICK_SIZE: Record<string, number> = { NQ: 0.25, MNQ: 0.25, ES: 0.25, MES: 0.25 }
const POINT_VALUES: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5 }

function sym(instrument: string) {
  return instrument.replace(/\s.*/, "").toUpperCase()
}

// Rating derived from edge ratio (captured % of MFE)
function tradeRating(trade: Trade): number {
  if (!trade.mfe || trade.mfe === 0) return 3
  const captured = Math.abs(trade.netPnl) / Math.abs(trade.mfe)
  if (captured >= 0.75) return 5
  if (captured >= 0.55) return 4
  if (captured >= 0.35) return 3
  if (captured >= 0.15) return 2
  return 1
}

// Micro sparkline for running P&L shape
function RunningPnlSpark({ trade }: { trade: Trade }): ReactElement {
  const mae  = trade.mae  !== null ? Math.abs(trade.mae)  : 0
  const mfe  = trade.mfe  !== null ? Math.abs(trade.mfe)  : Math.abs(trade.netPnl)
  const net  = trade.netPnl
  const isL  = trade.direction === "long"

  const W = 160, H = 36
  // key points: 0 → dip to -mae → recover to net
  const points = [
    [0,   0],
    [W * 0.25, -mae],
    [W * 0.55, mfe * 0.6],
    [W,   net],
  ]

  const minY = Math.min(0, ...points.map(p => p[1]!)) - 4
  const maxY = Math.max(0, ...points.map(p => p[1]!)) + 4
  const range = maxY - minY || 1

  const sy = (v: number) => H - ((v - minY) / range) * H
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${sy(y!)}`).join(" ")
  const fill = `${path} L${W},${H} L0,${H} Z`

  const lineColor = net >= 0 ? "#22c55e" : "#ef4444"
  const fillId    = `spkfill-${isL ? "l" : "s"}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${fillId})`} />
      <path d={path} fill="none" stroke={lineColor} strokeWidth="1.5" />
    </svg>
  )
}

type PanelTab = "stats" | "strategy" | "executions" | "attachments"

type Props = {
  trade:       Trade
  account:     Account | null
  strategy:    Strategy | null
  activeTab:   PanelTab
  onTabChange: (t: PanelTab) => void
}

const TABS: { id: PanelTab; label: string }[] = [
  { id: "stats",       label: "Stats" },
  { id: "strategy",    label: "Strategy" },
  { id: "executions",  label: "Executions" },
  { id: "attachments", label: "Attach." },
]

export function StatsPanel({ trade, account, strategy, activeTab, onTabChange }: Props): ReactElement {
  const s           = sym(trade.instrument)
  const tickSz      = TICK_SIZE[s]  ?? 0.25
  const pointVal    = POINT_VALUES[s] ?? 1
  const isLong      = trade.direction === "long"
  const isProfit    = trade.netPnl >= 0
  const movePts     = (trade.exitPrice - trade.entryPrice) * (isLong ? 1 : -1)
  const ticksPerCon = Math.round(movePts / tickSz)
  const holdTime    = formatDuration(trade.entryTime, trade.exitTime)
  const rating      = tradeRating(trade)

  const StatRow = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <span className="text-xxs text-text-mute shrink-0">{label}</span>
      <span className="mono text-xs font-medium truncate" style={{ color: color ?? "var(--color-text)" }}>
        {value}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border" style={{ width: 200 }}>
      {/* Tabs */}
      <div className="grid border-b border-border shrink-0" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className="py-2 text-xxs font-medium transition-colors border-b-2"
            style={{
              color:       activeTab === t.id ? "var(--color-accent)" : "var(--color-text-mute)",
              borderColor: activeTab === t.id ? "var(--color-accent)" : "transparent",
              background:  "transparent",
              cursor:      "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats content */}
      {activeTab === "stats" && (
        <div className="flex-1 overflow-auto p-3 flex flex-col gap-0">
          {/* Hero P&L */}
          <div className="mb-3">
            <div className="label-caps mb-0.5">P&L</div>
            <div
              className="mono font-semibold tracking-tight"
              style={{ fontSize: 26, color: isProfit ? "var(--color-profit)" : "var(--color-loss)" }}
            >
              {formatCurrency(trade.netPnl, { sign: false })}
            </div>
            <div className="mt-1">
              <span
                className="mono text-xxs font-semibold px-1.5 py-0.5 rounded-xs"
                style={{
                  background: isLong ? "rgba(59,130,246,.15)" : "rgba(245,158,11,.15)",
                  color:      isLong ? "var(--color-long)"    : "var(--color-short)",
                  border:     `1px solid ${isLong ? "rgba(59,130,246,.35)" : "rgba(245,158,11,.35)"}`,
                }}
              >
                {isLong ? "LONG" : "SHORT"}
              </span>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-border/40">
            <div className="pb-2 flex flex-col">
              <StatRow label="Contracts loaded" value={String(trade.contracts)} />
              <StatRow label="Points" value={movePts.toFixed(2)} />
              <StatRow label="Ticks Per Contract" value={String(ticksPerCon)} />
              <StatRow label="Commissions & Fees" value={`$${trade.commission.toFixed(2)}`} color="var(--color-text-dim)" />
              <StatRow label="Net P&L" value={formatCurrency(trade.netPnl, { sign: false })} color={isProfit ? "var(--color-profit)" : "var(--color-loss)"} />
            </div>
            <div className="py-2 flex flex-col">
              <StatRow label="Gross P&L" value={formatCurrency(trade.pnl, { sign: false })} color={trade.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"} />
              <StatRow
                label="Max Adverse"
                value={trade.mae !== null ? formatCurrency(trade.mae, { sign: false }) : "—"}
                color="var(--color-loss)"
              />
              <StatRow
                label="Max Favorable"
                value={trade.mfe !== null ? formatCurrency(trade.mfe, { sign: false }) : "—"}
                color="var(--color-profit)"
              />
              <StatRow label="Hold Time" value={holdTime} />
              <StatRow label="Account" value={account?.name ?? "—"} color="var(--color-text-dim)" />
            </div>
            <div className="py-2 flex flex-col">
              <div className="label-caps mb-1.5">Running P&L</div>
              <div className="w-full">
                <RunningPnlSpark trade={trade} />
              </div>
            </div>
            <div className="py-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xxs text-text-mute">Trade Rating</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} style={{ color: i <= rating ? "#f59e0b" : "var(--color-border-hi)", fontSize: 11 }}>★</span>
                  ))}
                </div>
              </div>
              <StatRow label="Strategy" value={strategy?.name ?? "—"} color="var(--color-text-dim)" />
              <StatRow label="Session" value={trade.session ?? "—"} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "strategy" && (
        <div className="flex-1 overflow-auto p-3">
          {strategy ? (
            <>
              <div className="text-sm font-semibold text-text mb-2">{strategy.name}</div>
              {strategy.description && (
                <p className="text-xs text-text-dim leading-relaxed mb-3">{strategy.description}</p>
              )}
              {strategy.rules && (
                <>
                  <div className="label-caps mb-1.5">Rules</div>
                  <p className="text-xs text-text-dim leading-relaxed whitespace-pre-wrap">{strategy.rules}</p>
                </>
              )}
            </>
          ) : (
            <p className="text-xs text-text-mute mt-4 text-center">No strategy assigned</p>
          )}
        </div>
      )}

      {activeTab === "executions" && (
        <div className="flex-1 overflow-auto p-3">
          <div className="label-caps mb-2">Executions</div>
          <div className="flex flex-col gap-1">
            {[
              { label: "Entry", time: trade.entryTime, price: trade.entryPrice, color: "var(--color-long)" },
              { label: "Exit",  time: trade.exitTime,  price: trade.exitPrice,  color: isProfit ? "var(--color-profit)" : "var(--color-loss)" },
            ].map(row => (
              <div key={row.label} className="bg-surface-2 rounded-sm p-2 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xxs font-semibold" style={{ color: row.color }}>{row.label}</span>
                  <span className="mono text-xs font-semibold text-text">{row.price.toFixed(2)}</span>
                </div>
                <div className="mono text-xxs text-text-mute">
                  {new Date(row.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "attachments" && (
        <div className="flex-1 flex items-center justify-center p-3">
          <p className="text-xs text-text-mute text-center">No attachments</p>
        </div>
      )}
    </div>
  )
}
