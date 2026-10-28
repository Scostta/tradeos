import type { ReactElement, ReactNode } from "react"
import { INVEST } from "~/constants/copies/invest"
import { TriangleAlertIcon } from "~/lib/ui/icons/triangle-alert-icon"
import { cn } from "~/utils/cn"
import { PAPER_BADGE_CLS, fmtDay, fmtEur, fmtPct, fmtPrice, fmtShares, signColor } from "../../../components/invest-format"
import { ClosePositionButton } from "../../components/close-position-button.client"
import type { ClosedRow, OpenRow } from "../../components/positions-data"
import { SignalBadge } from "../../components/signal-badge"

const P = INVEST.POSITIONS
const D = INVEST.POSITION

function Stat({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="label-caps">{label}</span>
      <span className="mono text-md text-text whitespace-nowrap">{children}</span>
      {sub && <span className="text-xs text-text-mute truncate">{sub}</span>}
    </div>
  )
}

type Props = { row: { kind: "open"; data: OpenRow } | { kind: "closed"; data: ClosedRow } }

// Una posición (abierta o cerrada) con su tesis y falsadores completos (§4.3).
export function PositionDetailCard({ row }: Props): ReactElement {
  const p = row.data.position
  const open = row.kind === "open" ? row.data : null
  const closed = row.kind === "closed" ? row.data : null
  const sell = open?.check?.signal === "sell"
  const manual = p.exitReason === "manual"
  const net = closed?.result && closed.tax != null ? closed.result.netPnlEur - closed.tax : null

  return (
    <div className={cn("card flex flex-col", sell && "border-loss/40", p.paper && "border-dashed")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-border">
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-sm",
            open ? "bg-accent/10 text-accent" : "bg-surface-2 text-text-dim",
          )}
        >
          {open ? D.STATUS_OPEN : D.STATUS_CLOSED}
        </span>
        {p.paper && <span className={PAPER_BADGE_CLS}>{INVEST.PERFORMANCE.PAPER_BADGE}</span>}
        <span className="mono text-sm text-text-dim">
          {fmtDay(p.openedAt)}{p.closedAt && ` → ${fmtDay(p.closedAt)}`}
        </span>
        {open && (
          <div className="ml-auto flex items-center gap-2">
            <SignalBadge check={open.check} />
            <ClosePositionButton
              position={{
                id:         p.id,
                ticker:     p.ticker,
                currency:   p.currency,
                openedAt:   p.openedAt,
                falsifiers: p.falsifiers,
                sellSignal: sell,
                lastPrice:  open.valuation.lastPrice,
              }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 px-4 py-3">
        <Stat label={P.OPENED}>{fmtDay(p.openedAt)}</Stat>
        <Stat label={P.ENTRY}>{fmtPrice(p.entryPrice, p.currency)}</Stat>
        <Stat label={P.SHARES}>{fmtShares(p.shares)}</Stat>
        {open && (
          <>
            <Stat label={P.COST}>{fmtEur(open.valuation.costEur)}</Stat>
            <Stat
              label={P.LAST_PRICE}
              sub={open.valuation.lastMonth ? P.LAST_PRICE_AT.replace("{date}", open.valuation.lastMonth) : P.NO_PRICE}
            >
              {fmtPrice(open.valuation.lastPrice, p.currency)}
            </Stat>
            <Stat
              label={P.PNL}
              sub={<span className={signColor(open.valuation.pnlPct)}>{fmtPct(open.valuation.pnlPct, { sign: true })}</span>}
            >
              <span className={signColor(open.valuation.pnlEur)}>{fmtEur(open.valuation.pnlEur, { sign: true })}</span>
            </Stat>
          </>
        )}
        {closed && (
          <>
            <Stat label={D.CLOSED}>{p.closedAt ? fmtDay(p.closedAt) : "—"}</Stat>
            <Stat label={D.EXIT}>{fmtPrice(p.exitPrice, p.currency)}</Stat>
            <Stat label={D.NET} sub={D.NET_HINT}>
              <span className={signColor(net)}>{fmtEur(net, { sign: true })}</span>
            </Stat>
          </>
        )}
      </div>

      {closed && (
        <div className="flex flex-col gap-1.5 px-4 py-3 border-t border-border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-caps">{D.EXIT_REASON}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-sm",
                manual ? "bg-short/10 text-short" : "bg-surface-2 text-text-dim",
              )}
            >
              {manual && <TriangleAlertIcon />}
              {p.exitReason ? P.REASONS[p.exitReason] : "—"}
            </span>
            {manual && <span className="text-xs text-short" title={P.DEVIATION_HINT}>{P.DEVIATION}</span>}
          </div>
          {p.exitNote && <p className="text-sm text-text-dim whitespace-pre-wrap">{p.exitNote}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-3 border-t border-border">
        <div className="min-w-0">
          <span className="label-caps">{P.THESIS}</span>
          <p className="text-sm text-text-dim mt-1.5 whitespace-pre-wrap">{p.thesis}</p>
        </div>
        <div className="min-w-0">
          <span className="label-caps">{P.FALSIFIERS}</span>
          <ol className="mt-1.5 flex flex-col gap-1">
            {p.falsifiers.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-dim">
                <span className="mono text-xs text-text-mute mt-px">{i + 1}</span>
                <span className="min-w-0">{f}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
