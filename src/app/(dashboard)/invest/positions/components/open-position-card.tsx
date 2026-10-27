import type { ReactElement, ReactNode } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import type { OpenValuation } from "~/lib/calculations/invest-positions"
import type { LatestCheck } from "~/services/queries/invest"
import type { InvestPositionWithMeta } from "~/types/invest"
import { cn } from "~/utils/cn"
import { PAPER_BADGE_CLS, fmtDay, fmtEur, fmtPct, fmtPrice, fmtShares, signColor } from "../../components/invest-format"
import { ClosePositionButton } from "./close-position-button.client"

const P = INVEST.POSITIONS

type Props = {
  position:  InvestPositionWithMeta
  valuation: OpenValuation
  check:     LatestCheck | null
}

function Stat({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="label-caps">{label}</span>
      <span className="mono text-md text-text whitespace-nowrap">{children}</span>
      {sub && <span className="text-xs text-text-mute truncate">{sub}</span>}
    </div>
  )
}

function SignalBadge({ check }: { check: LatestCheck | null }): ReactElement {
  if (!check) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-mute">{P.NO_CHECK}</span>
  }
  const sell = check.signal === "sell"
  return (
    <span
      title={sell ? P.SELL_HINT.replace("{date}", fmtDay(check.runDate)) : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
        sell ? "bg-loss/10 text-loss" : "bg-profit/10 text-profit",
      )}
    >
      <span className={cn("size-1.5 rounded-full", sell ? "bg-loss" : "bg-profit")} />
      {sell ? P.SIGNAL_SELL : P.SIGNAL_HOLD}
    </span>
  )
}

export function OpenPositionCard({ position: p, valuation: v, check }: Props): ReactElement {
  const sell = check?.signal === "sell"

  return (
    <div className={cn("card flex flex-col", sell && "border-loss/40", p.paper && "border-dashed")}>
      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-border">
        <Link href={APP_URLS.INVEST_TICKER(p.ticker)} className="mono text-xl font-semibold tracking-tight text-text hover:text-accent">
          {p.ticker}
        </Link>
        {p.paper && <span className={PAPER_BADGE_CLS}>{INVEST.PERFORMANCE.PAPER_BADGE}</span>}
        <span className="text-md text-text-dim truncate">{p.name ?? ""}</span>
        <span className="text-xs px-2 py-0.5 rounded-sm bg-surface-2 text-text-dim">{p.sector ?? INVEST.SCREEN.NO_SECTOR}</span>
        <div className="ml-auto flex items-center gap-2">
          <SignalBadge check={check} />
          <ClosePositionButton
            position={{
              id:         p.id,
              ticker:     p.ticker,
              currency:   p.currency,
              openedAt:   p.openedAt,
              falsifiers: p.falsifiers,
              sellSignal: sell,
              lastPrice:  v.lastPrice,
            }}
          />
        </div>
      </div>

      {/* Números */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 px-4 py-3">
        <Stat label={P.OPENED}>{fmtDay(p.openedAt)}</Stat>
        <Stat label={P.ENTRY}>{fmtPrice(p.entryPrice, p.currency)}</Stat>
        <Stat label={P.SHARES}>{fmtShares(p.shares)}</Stat>
        <Stat label={P.COST}>{fmtEur(v.costEur)}</Stat>
        <Stat
          label={P.LAST_PRICE}
          sub={v.lastMonth ? P.LAST_PRICE_AT.replace("{date}", v.lastMonth) : P.NO_PRICE}
        >
          {fmtPrice(v.lastPrice, p.currency)}
        </Stat>
        <Stat label={P.PNL} sub={<span className={signColor(v.pnlPct)}>{fmtPct(v.pnlPct, { sign: true })}</span>}>
          <span className={signColor(v.pnlEur)}>{fmtEur(v.pnlEur, { sign: true })}</span>
        </Stat>
      </div>

      {/* Tesis plegada y falsadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-3 border-t border-border">
        <details className="group min-w-0">
          <summary className="label-caps cursor-pointer list-none flex items-center gap-1.5 select-none">
            <span className="transition-transform group-open:rotate-90">›</span>
            {P.THESIS}
          </summary>
          <p className="text-sm text-text-dim mt-2 whitespace-pre-wrap">{p.thesis}</p>
        </details>
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
