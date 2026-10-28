import type { ReactElement, ReactNode } from "react"
import { INVEST } from "~/constants/copies/invest"
import { getInvestSettings } from "~/services/queries/invest"
import { InvestOnboarding } from "../components/invest-onboarding"
import { fmtEur, signColor } from "../components/invest-format"
import { OpenPositionsTable } from "./components/open-positions-table"
import { ClosedPositionsTable } from "./components/closed-positions-table"
import { loadPositionsData } from "./components/positions-data"

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
  const data = await loadPositionsData()
  if (!data) {
    return <div className="card p-4 text-sm text-loss">{P.LOAD_ERROR}</div>
  }

  // §1.6: el resumen (y el máximo) es del modo actual; en modo real, las de
  // papel abiertas se listan pero no suman.
  const counted = data.open.filter(v => v.position.paper === paperMode)
  const sum = (xs: (number | null)[]) => (xs.some(x => x == null) ? null : xs.reduce<number>((a, x) => a + (x ?? 0), 0))
  const invested = sum(counted.map(v => v.valuation.costEur))
  const marketValue = sum(counted.map(v => v.valuation.valueEur))
  const unrealized = sum(counted.map(v => v.valuation.pnlEur))

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

      <OpenPositionsTable rows={data.open} />
      <ClosedPositionsTable rows={data.closed} />
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
