import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import { loadPositionsData } from "../components/positions-data"
import { PositionDetailCard } from "./components/position-detail-card"

const D = INVEST.POSITION

// Todas las posiciones del ticker (abiertas primero, luego cerradas de la más
// reciente a la más antigua) con su tesis y falsadores (§4.3).
export default async function InvestPositionPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}): Promise<ReactElement> {
  const ticker = decodeURIComponent((await params).ticker).trim().toUpperCase()
  const data = await loadPositionsData()

  const open = data?.open.filter(r => r.position.ticker === ticker) ?? []
  const closed = data?.closed.filter(r => r.position.ticker === ticker) ?? []
  const meta = (open[0] ?? closed[0])?.position
  const chips = [meta?.sector].filter((c): c is string => !!c)

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="min-w-0">
          <Link href={APP_URLS.INVEST_POSITIONS} className="text-sm text-text-mute hover:text-text">← {D.BACK}</Link>
          <div className="flex items-baseline gap-2.5 min-w-0 mt-0.5">
            <h1 className="mono text-xl font-semibold tracking-tight text-text">{ticker}</h1>
            {meta?.name && <span className="text-md text-text-dim truncate">{meta.name}</span>}
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {chips.map(c => (
                <span key={c} className="mono text-xs px-2 py-0.5 rounded-sm bg-surface-2 text-text-dim">{c}</span>
              ))}
            </div>
          )}
        </div>
        <Link href={APP_URLS.INVEST_TICKER(ticker)} className="btn-ghost ml-auto shrink-0">{D.SCREEN_DETAIL} →</Link>
      </header>

      <div className="flex-1 min-h-0 overflow-auto page-pad">
        <div className="flex flex-col gap-4">
          {!data ? (
            <div className="card p-4 text-sm text-loss">{D.LOAD_ERROR}</div>
          ) : open.length + closed.length === 0 ? (
            <div className="card px-4 py-16 text-sm text-text-mute text-center">{D.NOT_FOUND.replace("{ticker}", ticker)}</div>
          ) : (
            <>
              {open.map(r => <PositionDetailCard key={r.position.id} row={{ kind: "open", data: r }} />)}
              {closed.map(r => <PositionDetailCard key={r.position.id} row={{ kind: "closed", data: r }} />)}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
