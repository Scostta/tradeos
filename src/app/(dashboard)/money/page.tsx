import type { ReactElement } from "react"
import Link from "next/link"
import { ensureMonthsClosed } from "~/actions/finance"
import { APP_URLS } from "~/constants/app-urls"
import { MONEY } from "~/constants/copies/money"
import { monthOf } from "~/lib/finance/dates"
import { savingsRate } from "~/lib/finance/summary"
import {
  getFinanceCategories,
  getFinanceSettings,
  getGoals,
  getBudgets,
  getMoneySummary,
  getSubscriptions,
  getTransactions,
} from "~/services/queries/finance"
import { cn } from "~/utils/cn"
import { aiConfigured, inputHash } from "~/lib/ai/claude-json"
import { AddCashButton } from "./components/add-cash-button.client"
import { AiSummaryCard } from "./components/overview/ai-summary-card.client"
import { summaryInput } from "./components/overview/ai-summary-input"
import { MoneyOnboarding } from "./components/money-onboarding.client"
import { displayName, fmtDay, fmtEur } from "./components/money-format"
import { buildOverview } from "./components/overview/overview-data"
import type { OverviewData } from "./components/overview/overview-data"
import { Bar, Card, Chip, Metric } from "./components/overview/overview-parts"
import { MonthSelect } from "./components/month-select.client"
import { CashFlowCard } from "./components/overview/cash-flow-card"

const O = MONEY.OVERVIEW
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`)

function monthName(month: string, year = false): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: year ? "numeric" : undefined, timeZone: "UTC" })
}

function renewalWhen(days: number, date: string): string {
  return days === 0 ? MONEY.SUBSCRIPTIONS.TODAY : days <= 7 ? `${MONEY.SUBSCRIPTIONS.IN_DAYS.replace("{n}", String(days))} · ${fmtDay(date)}` : fmtDay(date)
}

// ── Bloques ───────────────────────────────────────────────────────────────

// La marca es el presupuesto del mes si lo hay (§5.9); si no, la media de 3 meses.
function CategoryBars({ d, limit, budgets }: { d: OverviewData; limit?: number; budgets: Record<string, number> | null }): ReactElement {
  const lines = limit ? d.categoryLines.slice(0, limit) : d.categoryLines
  // La media solo es referencia si es positiva (Bizum puede quedar en neto negativo).
  const ref = (l: OverviewData["categoryLines"][number]) => budgets
    ? (l.categoryId ? budgets[l.categoryId] ?? null : null)
    : (l.avg3 != null && l.avg3 > 0 ? l.avg3 : null)
  const scale = Math.max(1, ...d.categoryLines.map(l => Math.max(l.total, ref(l) ?? 0)))
  if (lines.length === 0) return <div className="px-4 py-8 text-center text-sm text-text-mute">{O.NO_SPENDING}</div>
  return (
    <div className="grid gap-x-3.5 gap-y-2.5 items-center px-4 py-3.5 text-sm" style={{ gridTemplateColumns: "minmax(0, 120px) 1fr auto" }}>
      {lines.map(l => {
        const avg = ref(l)
        const over = avg != null && l.total > avg
        const href = l.categoryId
          ? `${APP_URLS.MONEY_TRANSACTIONS}?month=${d.month}&category=${l.categoryId}`
          : `${APP_URLS.MONEY_TRANSACTIONS}?queue=1`
        return (
          <Link key={l.categoryId ?? "none"} href={href} className="contents group">
            <span className={cn("truncate group-hover:text-text", l.category ? "text-text-dim" : "text-short")}>
              {l.category?.name ?? MONEY.IMPORT.UNCATEGORIZED}
            </span>
            <Bar value={l.total / scale} mark={avg != null ? avg / scale : null} color={over ? "var(--color-loss)" : l.category?.color ?? "var(--color-short)"} />
            <span className={cn("mono text-xs text-right whitespace-nowrap", over ? "text-loss" : "text-text-mute")}>
              {fmtEur(l.total, { decimals: 0 })}{avg != null && ` / ${fmtEur(avg, { decimals: 0 })}`}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function Renewals({ d, limit }: { d: OverviewData; limit?: number }): ReactElement {
  const rows = limit ? d.renewals.slice(0, limit) : d.renewals
  if (rows.length === 0) return <div className="px-4 py-6 text-sm text-text-mute">{O.NO_RENEWALS}</div>
  return (
    <div className="flex flex-col">
      {rows.map(({ sub, days }) => (
        <div key={sub.id} className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border last:border-0">
          <div className="min-w-0">
            <div className="text-sm font-medium text-text truncate">{displayName(sub.counterparty)}</div>
            <div className={cn("mono text-xs", days <= 3 ? "text-short" : "text-text-mute")}>
              {renewalWhen(days, sub.nextExpected!)}{sub.cadence === "yearly" && ` · ${O.YEARLY}`}
            </div>
          </div>
          <span className="mono text-sm text-text shrink-0">{fmtEur(sub.amount)}</span>
        </div>
      ))}
    </div>
  )
}

function Goals({ d }: { d: OverviewData }): ReactElement {
  if (d.goals.length === 0) return <div className="px-4 py-6 text-sm text-text-mute">{O.NO_GOALS}</div>
  return (
    <div className="flex flex-col gap-3.5 px-4 py-3.5">
      {d.goals.map(({ goal, eta }) => (
        <div key={goal.id} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2 text-sm">
            <span className="font-medium text-text truncate">{goal.name}</span>
            <span className="mono text-xs text-text-mute shrink-0">
              <span className="text-text">{fmtEur(goal.savedAmount, { decimals: 0 })}</span> / {fmtEur(goal.targetAmount, { decimals: 0 })}
            </span>
          </div>
          <Bar value={goal.savedAmount / goal.targetAmount} color="var(--color-accent)" />
          <span className="text-xs text-text-mute">
            {O.GOAL_LINE.replace("{amount}", fmtEur(goal.monthlyAlloc, { decimals: 0 }))}{eta && ` · ${monthName(eta, true)}`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────

// §5.1 Overview (artboard 01; en móvil, M1). La referencia de las barras y
// de "Left" es la media de 3 meses mientras no hay presupuestos (v2).
export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}): Promise<ReactElement> {
  const params = await searchParams
  await ensureMonthsClosed()
  const settingsResult = await getFinanceSettings()
  const settings = settingsResult.success ? settingsResult.data : null

  const header = (subtitle: string | null, right?: ReactElement) => (
    <header className="flex flex-wrap items-center gap-3 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text">{MONEY.TITLE}</h1>
        <div className="mono text-sm text-text-mute mt-0.5 truncate">{subtitle ?? MONEY.SUBTITLE}</div>
      </div>
      {right}
    </header>
  )

  if (!settingsResult.success) {
    return <div className="flex flex-col h-full">{header(null)}<div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div></div>
  }
  if (!settings) return <div className="flex flex-col h-full">{header(null)}<MoneyOnboarding /></div>

  const [txResult, categoriesResult, subsResult, goalsResult] = await Promise.all([
    getTransactions({}),
    getFinanceCategories(),
    getSubscriptions(),
    getGoals(),
  ])
  if (!txResult.success || !categoriesResult.success || !subsResult.success || !goalsResult.success) {
    return <div className="flex flex-col h-full">{header(null)}<div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div></div>
  }

  if (txResult.data.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {header(null)}
        <div className="page-pad">
          <div className="card px-6 py-14 flex flex-col items-center gap-3 text-center">
            <div className="text-lg font-semibold text-text">{O.EMPTY_TITLE}</div>
            <p className="text-md text-text-dim">{O.EMPTY_BODY}</p>
            <Link href={APP_URLS.MONEY_IMPORT} className="btn-accent">{O.IMPORT}</Link>
          </div>
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const startDay = settings.monthStartDay
  const current = monthOf(today, startDay)
  const months = [...new Set([current, ...txResult.data.map(t => monthOf(t.bookedAt, startDay))])].sort().reverse()
  const month = params.month && months.includes(params.month) ? params.month : current

  const d = buildOverview({
    transactions: txResult.data, categories: categoriesResult.data, subscriptions: subsResult.data,
    goals: goalsResult.data, month, today, startDay, closedThrough: settings.closedThrough,
  })
  const s = d.summary
  const rate = savingsRate(s)

  // §5.9: presupuestos del mes (con Subscriptions automática) como marca de las barras.
  const budgetRes = await getBudgets(month)
  const subsCategory = categoriesResult.data.find(c => c.name === "Subscriptions" && c.kind === "expense" && !c.archived)
  const budgets = budgetRes.success && Object.keys(budgetRes.data.amounts).length > 0
    ? { ...budgetRes.data.amounts, ...(subsCategory ? { [subsCategory.id]: d.subs.monthly } : {}) }
    : null

  // §5.8: resumen con IA guardado; "stale" si las cifras cambiaron desde que se generó.
  const aiEnabled = aiConfigured()
  const stored = aiEnabled ? await getMoneySummary(month) : null
  const storedSummary = stored?.success ? stored.data : null
  const aiStale = storedSummary != null && storedSummary.inputHash !== await inputHash(summaryInput(d, categoriesResult.data))
  const aiCard = aiEnabled && (
    <AiSummaryCard
      key={month} month={month} stale={aiStale}
      initial={storedSummary ? { content: storedSummary.content, createdAt: storedSummary.createdAt } : null}
    />
  )
  const proj = s.projection

  const subtitle = d.isCurrent && proj
    ? O.SUBTITLE.replace("{month}", monthName(month)).replace("{left}", String(proj.daysLeft))
        .replace("{day}", String(proj.daysElapsed)).replace("{days}", String(proj.daysTotal))
    : O.SUBTITLE_PAST.replace("{month}", monthName(month, true))
  const importAgo = d.lastImportDays == null ? O.NEVER_IMPORTED
    : O.LAST_IMPORT.replace("{ago}", d.lastImportDays === 0 ? O.AGO_TODAY : O.AGO_DAYS.replace("{n}", String(d.lastImportDays)))
  const importStale = d.lastImportDays == null || d.lastImportDays > 7

  const leftValue = d.left == null ? "—" : fmtEur(d.left, { decimals: 0 })
  const leftTone = d.left == null ? undefined : d.left >= 0 ? "text-profit" : "text-loss"
  const leftSub = d.left == null ? O.LEFT_NO_HISTORY
    : d.isCurrent && d.projectedSpent != null
      ? O.LEFT_SUB.replace("{amount}", fmtEur(d.projectedSpent, { decimals: 0 }))
          .replace("{verdict}", d.projectedSpent <= (d.avg3Spent ?? Infinity) ? O.LEFT_WITHIN : O.LEFT_ABOVE)
      : O.LEFT_PAST
  const spentSub = d.avg3Spent == null ? O.SPENT_NO_HISTORY
    : O.SPENT_SUB.replace("{pct}", pct(s.spent / d.avg3Spent)).replace("{avg}", fmtEur(d.avg3Spent, { decimals: 0 }))
  const savingsSub = rate == null ? O.SAVINGS_NO_INCOME : O.SAVINGS_SUB.replace("{pct}", pct(rate))
  const subsMonthly = fmtEur(d.subs.monthly, { decimals: 0 })

  const chips = (
    <>
      {d.overAvg && (
        <Chip tone="loss" href={`${APP_URLS.MONEY_TRANSACTIONS}?month=${month}&category=${d.overAvg.category.id}`}>
          {O.CHIP_OVER_AVG.replace("{category}", d.overAvg.category.name).replace("{amount}", fmtEur(d.overAvg.delta, { decimals: 0 }))}
        </Chip>
      )}
      {d.uncategorized > 0 && (
        <Chip tone="short" href={`${APP_URLS.MONEY_TRANSACTIONS}?queue=1`}>{O.CHIP_UNCATEGORIZED.replace("{n}", String(d.uncategorized))}</Chip>
      )}
      {d.pace != null && Math.abs(d.pace) >= 1 && (
        <Chip tone={d.pace <= 0 ? "profit" : "loss"}>
          {(d.pace <= 0 ? O.CHIP_PACE_UNDER : O.CHIP_PACE_OVER).replace("{amount}", fmtEur(Math.abs(d.pace), { decimals: 0 }))}
        </Chip>
      )}
    </>
  )

  return (
    <div className="flex flex-col h-full">
      {header(subtitle, (
        <div className="ml-auto flex items-center gap-2.5">
          <span className={cn(
            "hidden sm:inline mono text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm",
            importStale ? "bg-short/10 text-short" : "bg-surface-2 text-text-mute",
          )}>
            {importAgo}
          </span>
          <AddCashButton />
          <Link href={APP_URLS.MONEY_IMPORT} className="btn-accent hidden md:inline-flex">{O.IMPORT}</Link>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
        <div className="flex flex-wrap gap-1.5">{chips}</div>
        <div className="ml-auto"><MonthSelect months={months} value={month} current={current} /></div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto page-pad">
        {/* Escritorio (artboard 01) */}
        <div className="hidden md:flex flex-col gap-3">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Metric label={O.SPENT} value={fmtEur(s.spent, { decimals: 0 })}>
              {d.avg3Spent != null && <Bar value={s.spent / d.avg3Spent} color="var(--color-long)" />}
              <span>{spentSub}</span>
            </Metric>
            <Metric label={O.LEFT} value={leftValue} tone={leftTone}><span>{leftSub}</span></Metric>
            <Metric label={O.SAVINGS} value={fmtEur(s.realSavings, { decimals: 0 })} tone={s.realSavings < 0 ? "text-loss" : undefined}>
              <span>{savingsSub}</span>
            </Metric>
            <Metric label={O.SUBS} value={String(d.subs.active)}>
              <span>{O.SUBS_SUB.replace("{monthly}", subsMonthly).replace("{yearly}", fmtEur(d.subs.yearly, { decimals: 0 })).replace("{unused}", String(d.subs.unused))}</span>
            </Metric>
          </div>

          {aiCard}

          <div className="grid grid-cols-3 gap-3">
            <Card title={O.BY_CATEGORY} right={<span className="text-xs text-text-mute">{budgets ? O.VS_BUDGET : O.VS_AVG}</span>} className="col-span-2">
              <CategoryBars d={d} budgets={budgets} />
            </Card>
            <Card title={O.RENEWALS} link={{ href: APP_URLS.MONEY_SUBSCRIPTIONS, label: O.VIEW_ALL }}>
              <Renewals d={d} />
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card
              title={O.CASH_FLOW} className="col-span-2"
              right={d.avg6Savings != null ? <span className="mono text-xs text-text-mute">{O.AVG_SAVINGS.replace("{amount}", fmtEur(d.avg6Savings, { decimals: 0 }))}</span> : undefined}
            >
              <CashFlowCard months={d.history} selected={month} />
            </Card>
            <Card title={O.GOALS} link={{ href: APP_URLS.MONEY_GOALS, label: O.VIEW_ALL }}><Goals d={d} /></Card>
          </div>
        </div>

        {/* Móvil (M1): "Left this month" primero, dos tarjetas, categorías y renovaciones */}
        <div className="flex md:hidden flex-col gap-2.5">
          <span className={cn("self-start mono text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm", importStale ? "bg-short/10 text-short" : "bg-surface-2 text-text-mute")}>
            {importAgo}
          </span>
          <Metric label={O.LEFT_MOBILE} value={leftValue} tone={leftTone} big>
            {d.avg3Spent != null && <Bar value={s.spent / d.avg3Spent} color="var(--color-long)" />}
            {d.avg3Spent != null && (
              <span className="flex justify-between mono">
                <span>{O.SPENT_SHORT.replace("{amount}", fmtEur(s.spent, { decimals: 0 }))}</span><span>{fmtEur(d.avg3Spent, { decimals: 0 })}</span>
              </span>
            )}
            <span>{leftSub}</span>
          </Metric>
          <div className="grid grid-cols-2 gap-2.5">
            <Metric label={O.SAVINGS} value={fmtEur(s.realSavings, { decimals: 0 })} tone={s.realSavings < 0 ? "text-loss" : undefined}>
              <span>{rate == null ? "—" : O.SAVINGS_MOBILE_SUB.replace("{pct}", pct(rate))}</span>
            </Metric>
            <Metric label={MONEY.SUBSCRIPTIONS.TITLE} value={subsMonthly}>
              <span>{O.SUBS_MOBILE_SUB.replace("{unused}", String(d.subs.unused))}</span>
            </Metric>
          </div>
          {aiCard}
          <Card title={O.BY_CATEGORY_MOBILE} link={{ href: `${APP_URLS.MONEY_TRANSACTIONS}?month=${month}`, label: O.VIEW_ALL }}>
            <CategoryBars d={d} limit={4} budgets={budgets} />
          </Card>
          <Card title={O.RENEWALS} link={{ href: APP_URLS.MONEY_SUBSCRIPTIONS, label: O.VIEW_ALL }}>
            <Renewals d={d} limit={2} />
          </Card>
        </div>
      </div>
    </div>
  )
}
