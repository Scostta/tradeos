import type { ReactElement, ReactNode } from "react"
import { formatCurrency } from "~/helpers/format"
import { PROP_FIRM } from "~/constants/copies/prop-firm"
import { cn } from "~/utils/cn"
import type { PropPhase } from "~/types/account"
import type { PropFirmStatus, AlertLevel } from "~/types/prop-firm"

const ALERT_COLOR: Record<AlertLevel, string> = {
  safe:     "var(--color-profit)",
  warning:  "#f59e0b",
  danger:   "#f97316",
  breached: "var(--color-loss)",
}

function riskColor(usedPct: number): string {
  if (usedPct >= 1)   return "var(--color-loss)"
  if (usedPct >= 0.8) return "#f97316"
  if (usedPct >= 0.5) return "#f59e0b"
  return "var(--color-profit)"
}

function Bar({ pct, color }: { pct: number; color: string }): ReactElement {
  return (
    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, background: color }} />
    </div>
  )
}

function Block({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-sm bg-surface border border-border">
      <div className="label-caps">{label}</div>
      {children}
    </div>
  )
}

export function PropFirmStatusCard({ status, phase, initialBalance }: {
  status:         PropFirmStatus
  phase:          PropPhase | null
  initialBalance: number | null
}): ReactElement {
  const { netPnl, currentBalance, drawdown, dailyLoss, profit, tradingDays, alertLevel } = status
  const alertColor = ALERT_COLOR[alertLevel]

  return (
    <div
      className="card p-4 flex flex-col gap-3"
      style={{ borderColor: alertLevel === "safe" ? undefined : alertColor }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="text-md font-semibold text-text">{PROP_FIRM.STATUS_TITLE}</span>
          {phase && (
            <span className="text-xs mono tracking-wider rounded-sm px-2 py-0.5 border border-border bg-surface-2 text-text-dim">
              {PROP_FIRM.PHASE_LABELS[phase]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="mono text-sm">
            <span className="text-text-mute">{PROP_FIRM.BALANCE} </span>
            <span className={netPnl >= 0 ? "text-profit" : "text-loss"}>
              {formatCurrency(netPnl)}
            </span>
            {initialBalance != null && (
              <span className="text-text-dim"> · {formatCurrency(currentBalance, { sign: false })}</span>
            )}
          </span>
          <span
            className="text-xs mono font-semibold tracking-wider rounded-sm px-2 py-0.5"
            style={{ color: alertColor, background: `color-mix(in srgb, ${alertColor} 14%, transparent)` }}
          >
            {PROP_FIRM.ALERT[alertLevel].toUpperCase()}
          </span>
        </div>
      </div>

      {/* Blocks */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {drawdown && (
          <Block label={PROP_FIRM.DRAWDOWN}>
            <div className="mono text-lg font-semibold" style={{ color: riskColor(drawdown.usedPct) }}>
              {formatCurrency(drawdown.distance, { sign: false })}
            </div>
            <Bar pct={drawdown.usedPct} color={riskColor(drawdown.usedPct)} />
            <div className="flex justify-between mono text-xxs text-text-mute">
              <span>{PROP_FIRM.ROOM_LEFT}</span>
              <span>{PROP_FIRM.FLOOR} {formatCurrency(drawdown.threshold, { sign: false })}</span>
            </div>
          </Block>
        )}

        {dailyLoss && (
          <Block label={PROP_FIRM.DAILY_LOSS_C}>
            <div className="mono text-lg font-semibold" style={{ color: riskColor(dailyLoss.usedPct) }}>
              {formatCurrency(dailyLoss.remaining, { sign: false })}
            </div>
            <Bar pct={dailyLoss.usedPct} color={riskColor(dailyLoss.usedPct)} />
            <div className="flex justify-between mono text-xxs text-text-mute">
              <span>{PROP_FIRM.REMAINING}</span>
              <span>{formatCurrency(dailyLoss.used, { sign: false })} {PROP_FIRM.OF} {formatCurrency(dailyLoss.limit, { sign: false })}</span>
            </div>
          </Block>
        )}

        {profit && (
          <Block label={PROP_FIRM.TARGET}>
            <div className={cn("mono text-lg font-semibold", profit.reached ? "text-profit" : "text-text")}>
              {(profit.pct * 100).toFixed(0)}%
            </div>
            <Bar pct={profit.pct} color={profit.reached ? "var(--color-profit)" : "var(--color-accent)"} />
            <div className="flex justify-between mono text-xxs text-text-mute">
              <span>{formatCurrency(profit.progress, { sign: false })}</span>
              <span>{PROP_FIRM.OF} {formatCurrency(profit.target, { sign: false })}</span>
            </div>
          </Block>
        )}

        {tradingDays && (
          <Block label={PROP_FIRM.DAYS}>
            <div className={cn("mono text-lg font-semibold", tradingDays.met ? "text-profit" : "text-text")}>
              {tradingDays.done} <span className="text-text-mute">/ {tradingDays.required}</span>
            </div>
            <Bar pct={tradingDays.required ? tradingDays.done / tradingDays.required : 0} color="var(--color-accent)" />
            <div className="mono text-xxs text-text-mute">
              {tradingDays.remaining > 0 ? `${tradingDays.remaining} ${PROP_FIRM.REMAINING}` : "—"}
            </div>
          </Block>
        )}
      </div>
    </div>
  )
}
