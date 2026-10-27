import type { ReactElement, ReactNode } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import { getInvestSettings, getLatestChecks, getPositions, getPricesFor } from "~/services/queries/invest"
import { EUR_FX_TICKERS, buildPriceIndex, monthKey, shiftMonth } from "~/lib/calculations/invest-fx"
import {
  closedPositionResult,
  estimatedTaxByClose,
  valueOpenPosition,
} from "~/lib/calculations/invest-positions"
import { InvestOnboarding } from "../components/invest-onboarding"
import { fmtEur, signColor } from "../components/invest-format"
import { OpenPositionCard } from "./components/open-position-card"
import { ClosedPositionsTable } from "./components/closed-positions-table"
import type { ClosedRow } from "./components/closed-positions-table"

const P = INVEST.POSITIONS

function Tile({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="card flex flex-col gap-2 px-4 py-3.5 min-w-0">
      <span className="label-caps">{label}</span>
      <span className="mono text-2xl font-semibold tracking-tight text-text">{children}</span>
    </div>
  )
}

async function PositionsContent({ maxPositions, paperMode }: { maxPositions: number; paperMode: boolean }): Promise<ReactElement> {
  const positionsResult = await getPositions()
  if (!positionsResult.success) {
    return <div className="card p-4 text-sm text-loss">{P.LOAD_ERROR}</div>
  }
  const positions = positionsResult.data
  const open = positions.filter(p => p.closedAt == null)
  const closed = positions.filter(p => p.closedAt != null)

  // Precios de los tickers + pares FX desde un mes antes de la primera apertura
  // (el FX de un mes aún abierto es el del cierre anterior).
  const earliest = positions.map(p => p.openedAt).sort()[0]
  const from = earliest ? `${shiftMonth(monthKey(earliest), -1)}-01` : null
  const [checksResult, pricesResult] = await Promise.all([
    getLatestChecks(open.map(p => p.id)),
    from
      ? getPricesFor([...positions.map(p => p.ticker), ...Object.values(EUR_FX_TICKERS)], from)
      : Promise.resolve({ success: true as const, data: [] }),
  ])
  if (!checksResult.success || !pricesResult.success) {
    return <div className="card p-4 text-sm text-loss">{P.LOAD_ERROR}</div>
  }
  const index = buildPriceIndex(pricesResult.data)

  const valued = open.map(p => ({ position: p, valuation: valueOpenPosition(p, index) }))
  // §1.6: el resumen (y el máximo) es del modo actual; en modo real, las de
  // papel abiertas se listan pero no suman.
  const counted = valued.filter(v => v.position.paper === paperMode)
  const sum = (xs: (number | null)[]) => (xs.some(x => x == null) ? null : xs.reduce<number>((a, x) => a + (x ?? 0), 0))
  const invested = sum(counted.map(v => v.valuation.costEur))
  const marketValue = sum(counted.map(v => v.valuation.valueEur))
  const unrealized = sum(counted.map(v => v.valuation.pnlEur))

  const closedResults = closed.map(p => ({ position: p, result: closedPositionResult(p, index) }))
  const taxes = estimatedTaxByClose(
    closedResults
      .filter(c => c.result != null)
      .map(c => ({ id: c.position.id, closedAt: c.position.closedAt as string, netPnlEur: c.result!.netPnlEur })),
  )
  const closedRows: ClosedRow[] = closedResults
    .map(c => ({ ...c, tax: taxes.get(c.position.id) ?? null }))
    .sort((a, b) => (b.position.closedAt ?? "").localeCompare(a.position.closedAt ?? ""))

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Tile label={paperMode ? `${P.OPEN_COUNT} · ${INVEST.PERFORMANCE.PAPER_BADGE}` : P.OPEN_COUNT}>
          {counted.length}<span className="text-md text-text-mute font-normal"> / {maxPositions}</span>
        </Tile>
        <Tile label={P.INVESTED}>{fmtEur(counted.length ? invested : 0)}</Tile>
        <Tile label={P.MARKET_VALUE}>{fmtEur(counted.length ? marketValue : 0)}</Tile>
        <Tile label={P.UNREALIZED}>
          <span className={signColor(unrealized)}>{fmtEur(counted.length ? unrealized : 0, { sign: true })}</span>
        </Tile>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-md font-semibold text-text">{P.OPEN_TITLE}</span>
          <span className="mono text-xs px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent">{open.length}</span>
        </div>
        {open.length === 0 ? (
          <div className="card px-4 py-10 flex flex-col items-center gap-3 text-center">
            <span className="text-sm text-text-mute">{P.OPEN_EMPTY}</span>
            <Link href={APP_URLS.INVEST} className="btn-ghost">{P.GO_TO_SCREEN}</Link>
          </div>
        ) : (
          valued.map(({ position, valuation }) => (
            <OpenPositionCard
              key={position.id}
              position={position}
              valuation={valuation}
              check={checksResult.data[position.id] ?? null}
            />
          ))
        )}
      </div>

      <ClosedPositionsTable rows={closedRows} />
    </>
  )
}

export default async function InvestPositionsPage(): Promise<ReactElement> {
  const settingsResult = await getInvestSettings()
  const settings = settingsResult.success ? settingsResult.data : null

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{P.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{P.SUBTITLE}</div>
        </div>
      </header>

      {!settingsResult.success ? (
        <div className="page-pad">
          <div className="card p-4 text-sm text-loss">{P.LOAD_ERROR}</div>
        </div>
      ) : !settings ? (
        <InvestOnboarding />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto page-pad">
          <div className="flex flex-col gap-5">
            <PositionsContent maxPositions={settings.maxPositions} paperMode={settings.paperMode} />
          </div>
        </div>
      )}
    </div>
  )
}
