import type { ReactElement, ReactNode } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import { aiConfigured, inputHash } from "~/lib/ai/claude-json"
import { reviewContentSchema } from "~/lib/invest/ai/review"
import { reviewInput } from "~/lib/invest/ai/review-input"
import { getFundamentalsHistory, getInvestAiNote, getLatestRun, getPositionChecks, getPricesFor, getScreenResult } from "~/services/queries/invest"
import { monthKey, shiftMonth } from "~/lib/calculations/invest-fx"
import { nextMonthlyClose } from "~/lib/calculations/invest-calendar"
import { exitLevel, smaSteps } from "~/lib/calculations/invest-position-chart"
import { cn } from "~/utils/cn"
import { PAPER_BADGE_CLS, fmtDay } from "../../components/invest-format"
import { loadPositionsData } from "../components/positions-data"
import { ClosePositionButton } from "../components/close-position-button.client"
import { SignalBadge } from "../components/signal-badge"
import { PositionSummary } from "./components/position-summary"
import { PositionChart } from "./components/position-chart.client"
import type { PnlTone } from "./components/position-chart.client"
import { ThesisFalsifiers } from "./components/thesis-falsifiers.client"
import { ChecksTable } from "./components/checks-table"
import { AiReviewCard } from "./components/ai-review-card.client"

const D = INVEST.POSITION
// 18 meses de velas + los 9 cierres previos que necesita la primera SMA 10.
const PRICE_MONTHS = 18 + 10
const TONE_CSS: Record<PnlTone, string> = { profit: "var(--color-profit)", loss: "var(--color-loss)", neutral: "var(--color-text-dim)" }

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

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }): ReactElement {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("w-3.5 border-t-2", dashed && "border-dashed")} style={{ borderColor: color }} />
      {label}
    </span>
  )
}

// §4.3: una posición (abierta o cerrada): gráfico, tesis y falsadores con su
// estado manual, checks mensuales y cierre. Los fundamentales están en el
// detalle del ticker (/invest/[ticker]); aquí no se repiten.
export default async function InvestPositionPage({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReactElement> {
  const { id } = await params
  const data = await loadPositionsData()
  const openRow = data?.open.find(r => r.position.id === id) ?? null
  const closedRow = data?.closed.find(r => r.position.id === id) ?? null
  const p = (openRow ?? closedRow)?.position ?? null

  const today = new Date().toISOString().slice(0, 10)
  const [checksResult, pricesResult] = p
    ? await Promise.all([
        getPositionChecks(p.id),
        getPricesFor([p.ticker], `${shiftMonth(monthKey(today), -PRICE_MONTHS)}-01`),
      ])
    : [null, null]

  // §4.8: revisión de la IA (solo abiertas); "stale" si hay run nuevo o cambiaron los datos.
  let aiCard: ReactElement | null = null
  if (openRow && p && aiConfigured() && checksResult?.success) {
    const runRes = await getLatestRun()
    const run = runRes.success ? runRes.data : null
    if (run) {
      const [note, result, fundamentals] = await Promise.all([
        getInvestAiNote("review", run.id, p.id), getScreenResult(run.id, p.ticker), getFundamentalsHistory(p.ticker),
      ])
      const content = note.success && note.data ? reviewContentSchema.safeParse(note.data.content) : null
      const initial = content?.success && note.success && note.data ? { content: content.data, createdAt: note.data.createdAt } : null
      const stale = initial != null && result.success && fundamentals.success && note.success && note.data?.inputHash
        !== await inputHash(reviewInput({ run, position: p, result: result.data, checks: checksResult.data, fundamentals: fundamentals.data }))
      aiCard = <AiReviewCard runId={run.id} positionId={p.id} falsifiers={p.falsifiers} initial={initial} stale={stale} />
    }
  }

  const header = (
    <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
      <div className="min-w-0">
        <Link href={APP_URLS.INVEST_POSITIONS} className="text-sm text-text-mute hover:text-text">← {D.BACK}</Link>
        {p && (
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 min-w-0 mt-0.5">
            <h1 className="mono text-xl font-semibold tracking-tight text-text">{p.ticker}</h1>
            {p.name && <span className="text-md text-text-dim truncate">{p.name}</span>}
            <span className={cn("self-center text-xs font-medium px-2 py-0.5 rounded-sm", openRow ? "bg-accent/10 text-accent" : "bg-surface-2 text-text-dim")}>
              {openRow ? D.STATUS_OPEN : D.STATUS_CLOSED}
            </span>
            {p.paper && <span className={cn(PAPER_BADGE_CLS, "self-center")}>{INVEST.PERFORMANCE.PAPER_BADGE}</span>}
          </div>
        )}
      </div>
      {p && (
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <Link href={APP_URLS.INVEST_TICKER(p.ticker)} className="btn-ghost">{D.TICKER_DETAIL} →</Link>
          {openRow && (
            <ClosePositionButton
              position={{
                id:         p.id,
                ticker:     p.ticker,
                currency:   p.currency,
                openedAt:   p.openedAt,
                falsifiers: p.falsifiers,
                sellSignal: openRow.check?.signal === "sell",
                lastPrice:  openRow.valuation.lastPrice,
              }}
            />
          )}
        </div>
      )}
    </header>
  )

  const body = (() => {
    if (!data || (checksResult && !checksResult.success) || (pricesResult && !pricesResult.success)) {
      return <div className="card p-4 text-sm text-loss">{D.LOAD_ERROR}</div>
    }
    if (!p) {
      return <div className="card px-4 py-16 text-sm text-text-mute text-center">{D.NOT_FOUND}</div>
    }

    const prices = pricesResult?.success ? pricesResult.data : []
    const checks = checksResult?.success ? checksResult.data : []
    const evaluation = nextMonthlyClose(today)
    const level = openRow ? exitLevel(prices, p.ticker, evaluation) : null
    // Cerradas: precio de salida en el color del P&L neto realizado (el del resumen).
    const net = closedRow?.result && closedRow.tax != null ? closedRow.result.netPnlEur - closedRow.tax : null
    const tone: PnlTone = net == null || net === 0 ? "neutral" : net > 0 ? "profit" : "loss"
    const exit = closedRow && p.exitPrice != null && p.closedAt ? { price: p.exitPrice, date: p.closedAt, tone } : null

    return (
      <>
        <PositionSummary row={openRow ? { kind: "open", data: openRow } : { kind: "closed", data: closedRow! }} />

        <Card
          title={D.CHART_TITLE}
          right={
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-dim">
              <Legend color="#3b82f6" label={D.LEGEND_ENTRY} dashed />
              <Legend color="var(--color-accent)" label={D.LEGEND_SMA} />
              {level != null && <Legend color="var(--color-loss)" label={D.LEGEND_EXIT} dashed />}
              {exit && <Legend color={TONE_CSS[exit.tone]} label={D.LEGEND_EXIT_PRICE} dashed />}
            </div>
          }
        >
          <div className="px-2 pt-3">
            <PositionChart
              ticker={p.ticker}
              entryPrice={p.entryPrice}
              openedAt={p.openedAt}
              steps={smaSteps(prices, p.ticker)}
              exitLevel={level}
              exit={exit}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-2.5 border-t border-border text-xs text-text-mute">
            {openRow && <span>{D.EXIT_RULE.replace("{date}", fmtDay(evaluation))}</span>}
            <span>{D.CHART_NOTE}</span>
          </div>
        </Card>

        <Card title={D.THESIS_TITLE}>
          <ThesisFalsifiers
            positionId={p.id}
            thesis={p.thesis}
            falsifiers={p.falsifiers}
            status={p.falsifierStatus}
            editable={openRow != null}
          />
        </Card>

        {aiCard}

        <Card title={D.CHECKS_TITLE} right={openRow && <SignalBadge check={openRow.check} />}>
          <ChecksTable checks={checks} currency={p.currency} />
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
