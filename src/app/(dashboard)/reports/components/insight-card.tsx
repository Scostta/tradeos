import type { ReactElement } from "react"
import { formatCurrency, formatPct } from "~/helpers/format"

type InsightKind = "up" | "down" | "bar" | "cup"

type Props = {
  kind:    InsightKind
  label:   string
  value:   string
  subinfo: string
  pnl?:    number
}

// Hoisted to module scope — avoids allocating JSX elements on every render call
const INSIGHT_ICONS: Record<InsightKind, ReactElement> = {
  up: (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="var(--color-profit)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13l4-4 3 3 5-6" />
      <path d="M12 6h3v3" />
    </svg>
  ),
  down: (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="var(--color-loss)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5l4 4 3-3 5 6" />
      <path d="M12 12h3V9" />
    </svg>
  ),
  bar: (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="var(--color-long)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="15" x2="3" y2="9" />
      <line x1="9" y1="15" x2="9" y2="4" />
      <line x1="15" y1="15" x2="15" y2="11" />
    </svg>
  ),
  cup: (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="var(--color-accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h8v3a4 4 0 0 1-8 0V3z" />
      <path d="M5 4H3v1a2 2 0 0 0 2 2M13 4h2v1a2 2 0 0 1-2 2" />
      <line x1="9" y1="10" x2="9" y2="13" />
      <line x1="6" y1="15" x2="12" y2="15" />
    </svg>
  ),
}

export function InsightCard(props: Props): ReactElement {
  const { kind, label, value, subinfo, pnl } = props

  const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

  return (
    <div
      className="card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {INSIGHT_ICONS[kind]}
        <span
          style={{
            fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
            color: "var(--color-text-mute)", textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>

      <div
        style={{
          fontSize: 22, fontWeight: 600,
          color: "var(--color-text)", letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize:   12,
          color:      "var(--color-text-mute)",
          fontFamily: monoFont,
        }}
      >
        {subinfo}
        {pnl != null && (
          <span
            style={{
              color:      pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)",
              marginLeft: 8,
            }}
          >
            {formatCurrency(pnl, { sign: true, decimals: 2 })}
          </span>
        )}
      </div>
    </div>
  )
}

/** Formats win-rate insight subinfo string consistently */
export function fmtWinRateSubinfo(winRate: number, trades: number): string {
  return `${formatPct(winRate)} / ${trades} trades`
}

/** Formats trade-count subinfo string consistently */
export function fmtTradesSubinfo(trades: number): string {
  return `${trades} trades`
}
