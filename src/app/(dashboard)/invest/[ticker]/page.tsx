import type { ReactElement, ReactNode } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import {
  getFundamentalsHistory,
  getInvestSettings,
  getInvestTicker,
  getLatestRun,
  getPricesFor,
  getScreenResult,
  getThesisDrafts,
} from "~/services/queries/invest"
import { chartFrom, fundamentalsWithChanges, priceChartSeries } from "~/lib/calculations/invest-detail"
import { mapThesisAnswersFromDb } from "~/services/mappers/invest"
import { InvestOnboarding } from "../components/invest-onboarding"
import { TickerDetail } from "../components/ticker-detail"
import { fmtDay } from "../components/invest-format"
import { PriceChart } from "./components/price-chart.client"
import { FundamentalsTable } from "./components/fundamentals-table"
import { ThesisPrompts } from "./components/thesis-prompts.client"

const D = INVEST.DETAIL

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }): ReactElement {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 border-b border-border">
        <span className="text-md font-semibold text-text">{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}

// §4.7: ayuda a escribir la tesis y los falsadores; no decide nada.
export default async function InvestTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}): Promise<ReactElement> {
  const ticker = decodeURIComponent((await params).ticker).trim().toUpperCase()

  const [settingsResult, runResult, tickerResult, historyResult, draftsResult] = await Promise.all([
    getInvestSettings(),
    getLatestRun(),
    getInvestTicker(ticker),
    getFundamentalsHistory(ticker),
    getThesisDrafts(),
  ])
  const settings = settingsResult.success ? settingsResult.data : null
  const run = runResult.success ? runResult.data : null
  const info = tickerResult.success ? tickerResult.data : null

  const benchmark = run?.benchmark ?? settings?.benchmarkTicker ?? "IWDA.AS"
  const today = new Date().toISOString().slice(0, 10)
  const [resultResult, pricesResult] = await Promise.all([
    run ? getScreenResult(run.id, ticker) : Promise.resolve(null),
    getPricesFor([ticker, benchmark], chartFrom(today)),
  ])
  const result = resultResult?.success ? resultResult.data : null

  const loadFailed =
    !settingsResult.success || !runResult.success || !tickerResult.success || !historyResult.success ||
    !draftsResult.success || !pricesResult.success || (resultResult != null && !resultResult.success)

  const name = info?.name ?? result?.name ?? null
  const chips = [info?.exchange ?? result?.exchange, info?.sector ?? result?.sector, info?.industry, info?.currency ?? result?.currency]
    .filter((c): c is string => !!c)

  const header = (
    <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
      <div className="min-w-0">
        <Link href={APP_URLS.INVEST} className="text-sm text-text-mute hover:text-text">← {D.BACK}</Link>
        <div className="flex items-baseline gap-2.5 min-w-0 mt-0.5">
          <h1 className="mono text-xl font-semibold tracking-tight text-text">{ticker}</h1>
          {name && <span className="text-md text-text-dim truncate">{name}</span>}
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {chips.map(c => (
              <span key={c} className="mono text-xs px-2 py-0.5 rounded-sm bg-surface-2 text-text-dim">{c}</span>
            ))}
          </div>
        )}
      </div>
    </header>
  )

  if (settingsResult.success && !settings) {
    return <div className="flex flex-col h-full">{header}<InvestOnboarding /></div>
  }

  const body = (() => {
    if (loadFailed) return <div className="card p-4 text-sm text-loss">{D.LOAD_ERROR}</div>
    if (!info && !result) {
      return <div className="card px-4 py-16 text-sm text-text-mute text-center">{D.NOT_FOUND.replace("{ticker}", ticker)}</div>
    }
    const series = pricesResult.success ? priceChartSeries(pricesResult.data, ticker, benchmark) : []
    const fundamentals = historyResult.success ? fundamentalsWithChanges(historyResult.data) : []
    const draft = mapThesisAnswersFromDb(draftsResult.success ? draftsResult.data[ticker] : undefined)
    const currency = info?.currency ?? result?.currency ?? null

    return (
      <>
        <Card title={run ? D.LAST_RUN.replace("{date}", fmtDay(run.runDate)) : D.NOT_IN_RUN}>
          {result ? (
            <TickerDetail result={result} benchmark={benchmark} />
          ) : (
            <div className="px-4 py-6 text-sm text-text-mute">{D.NOT_IN_RUN}</div>
          )}
        </Card>

        <Card
          title={D.CHART_TITLE}
          right={series.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-dim">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-text" />{D.LEGEND_PRICE}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" />{D.LEGEND_SMA}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-long" />{D.LEGEND_RELATIVE.replace("{benchmark}", benchmark)}</span>
            </div>
          )}
        >
          <div className="px-2 py-3">
            {series.length > 1 ? (
              <PriceChart
                data={series}
                currency={currency}
                labels={{ price: D.LEGEND_PRICE, sma: D.LEGEND_SMA, relative: D.LEGEND_RELATIVE.replace("{benchmark}", benchmark) }}
              />
            ) : (
              <div className="py-12 text-center text-sm text-text-mute">{D.NO_HISTORY}</div>
            )}
          </div>
        </Card>

        <Card title={D.FUNDAMENTALS}>
          {fundamentals.length > 0 ? (
            <FundamentalsTable rows={fundamentals} currency={info?.financialCurrency ?? null} />
          ) : (
            <div className="px-4 py-8 text-center text-sm text-text-mute">{D.NO_FUNDAMENTALS}</div>
          )}
        </Card>

        <details className="card p-0 overflow-hidden group">
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none select-none">
            <span className="text-text-mute transition-transform group-open:rotate-90">›</span>
            <span className="text-md font-semibold text-text">{D.BUSINESS}</span>
          </summary>
          <p className="px-4 pb-4 text-sm text-text-dim whitespace-pre-wrap">{info?.summary ?? D.NO_SUMMARY}</p>
        </details>

        <Card title={D.PROMPTS_TITLE}>
          <div className="px-4 py-4">
            <ThesisPrompts ticker={ticker} initial={draft} />
          </div>
        </Card>
      </>
    )
  })()

  return (
    <div className="flex flex-col h-full">
      {header}
      <div className="flex-1 min-h-0 overflow-auto page-pad">
        <div className="flex flex-col gap-4">{body}</div>
      </div>
    </div>
  )
}
