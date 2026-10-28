import type { ReactElement, ReactNode } from "react"
import { INVEST } from "~/constants/copies/invest"
import { TriangleAlertIcon } from "~/lib/ui/icons/triangle-alert-icon"
import { cn } from "~/utils/cn"
import { fmtDay, fmtEur, fmtPct, fmtPrice, fmtShares, signColor } from "../../../components/invest-format"
import type { ClosedRow, OpenRow } from "../../components/positions-data"

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

// Números de la posición y, si está cerrada, su salida. La tesis, los
// falsadores y los checks van en sus propias tarjetas.
export function PositionSummary({ row }: Props): ReactElement {
  const p = row.data.position
  const open = row.kind === "open" ? row.data : null
  const closed = row.kind === "closed" ? row.data : null
  const manual = p.exitReason === "manual"
  const net = closed?.result && closed.tax != null ? closed.result.netPnlEur - closed.tax : null

  return (
    <div className="card flex flex-col">
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
    </div>
  )
}
