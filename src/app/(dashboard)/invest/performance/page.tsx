import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import {
  getInvestSettings,
  getLatestRun,
  getPositions,
  getPricesFor,
  getReviewedRunIds,
  getRunsSince,
} from "~/services/queries/invest"
import { EUR_FX_TICKERS, buildPriceIndex, monthKey } from "~/lib/calculations/invest-fx"
import {
  benchmarkMonthlyReturns,
  buildPerformanceReport,
  performanceBaseMonth,
  reviewStats,
  satelliteMonthlyReturns,
} from "~/lib/calculations/invest-performance"
import type { InvestPositionWithMeta, InvestSettings } from "~/types/invest"
import { InvestOnboarding } from "../components/invest-onboarding"
import { SettingsButton } from "../components/settings-button.client"
import { PerformanceView } from "./components/performance-view"

const P = INVEST.PERFORMANCE

async function PerformanceContent({ settings, positions }: {
  settings:  InvestSettings
  positions: InvestPositionWithMeta[]
}): Promise<ReactElement> {
  const base = performanceBaseMonth(settings.startedAt)
  const today = new Date().toISOString().slice(0, 10)

  const runResult = await getLatestRun()
  const through = runResult.success && runResult.data ? monthKey(runResult.data.runDate) : base
  const tickers = [...positions.map(p => p.ticker), ...Object.values(EUR_FX_TICKERS), settings.benchmarkTicker]
  const [pricesResult, runsResult, reviewsResult] = await Promise.all([
    getPricesFor(tickers, `${base}-01`),
    getRunsSince(`${base}-01`),
    getReviewedRunIds(),
  ])
  if (!runResult.success || !pricesResult.success || !runsResult.success || !reviewsResult.success) {
    return <div className="card p-4 text-sm text-loss">{P.LOAD_ERROR}</div>
  }

  const baseMonthEnd = buildPriceIndex(pricesResult.data).monthEnds.get(base) ?? null
  const satellite = satelliteMonthlyReturns(positions, pricesResult.data, settings, through)
  const benchmark = benchmarkMonthlyReturns(pricesResult.data, settings.benchmarkTicker, settings.startedAt, through)
  const report = baseMonthEnd ? buildPerformanceReport(satellite, benchmark, baseMonthEnd) : null

  return (
    <PerformanceView
      settings={settings}
      positions={positions}
      report={report}
      reviews={reviewStats(runsResult.data, reviewsResult.data, settings.startedAt)}
      today={today}
    />
  )
}

export default async function InvestPerformancePage(): Promise<ReactElement> {
  const [settingsResult, positionsResult] = await Promise.all([getInvestSettings(), getPositions()])
  const settings = settingsResult.success ? settingsResult.data : null
  const positions = positionsResult.success ? positionsResult.data : []
  const started = positions.length > 0

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{P.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{P.SUBTITLE}</div>
          <div className="text-sm text-text-mute mt-1">{P.HEADER_NOTE}</div>
        </div>
        {settings && (
          <div className="ml-auto">
            <SettingsButton settings={settings} started={started} />
          </div>
        )}
      </header>

      {!settingsResult.success || !positionsResult.success ? (
        <div className="page-pad">
          <div className="card p-4 text-sm text-loss">{P.LOAD_ERROR}</div>
        </div>
      ) : !settings ? (
        <InvestOnboarding />
      ) : !started ? (
        // §1.6: sin posiciones, started_at es provisional: no hay nada que medir.
        <div className="flex-1 min-h-0 overflow-auto page-pad">
          <div className="card p-6 flex flex-col items-center gap-3 text-center mx-auto" style={{ maxWidth: 560 }}>
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-short/10 text-short text-sm font-medium">
              <span className="size-1.5 rounded-full bg-short" />
              {P.PAPER_TITLE}
            </span>
            <p className="text-md text-text-dim">{P.PAPER_BODY}</p>
            <Link href={APP_URLS.INVEST} className="btn-ghost">{P.GO_TO_SCREEN}</Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto page-pad">
          <div className="flex flex-col gap-4">
            <PerformanceContent settings={settings} positions={positions} />
          </div>
        </div>
      )}
    </div>
  )
}
