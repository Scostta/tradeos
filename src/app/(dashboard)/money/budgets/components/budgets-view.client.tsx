"use client"

import { useState, useTransition } from "react"
import type { ReactElement, ReactNode } from "react"
import { saveBudgets } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import type { BudgetRow, BudgetTotals } from "~/lib/finance/budgets"
import type { Projection } from "~/lib/finance/summary"
import { Spinner } from "~/lib/ui/spinner"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { FinanceCategory } from "~/types/finance"
import { cn } from "~/utils/cn"
import { fmtEur, fmtMonth } from "../../components/money-format"
import { moneyErrorMessage } from "../../components/money-errors"

const B = MONEY.BUDGETS

/** "450", "450,5" → número ≥ 0; "" → null (sin presupuesto); undefined si no es válido. */
function parseAmount(s: string): number | null | undefined {
  if (!s.trim()) return null
  const n = Number(s.trim().replace(",", "."))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined
}

const pct = (n: number) => `${Math.round(n * 100)}%`

function monthName(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
}

function Metric({ label, value, tone, children }: { label: string; value: string; tone?: string; children?: ReactNode }): ReactElement {
  return (
    <div className="card flex flex-col gap-2 px-4 py-3.5 min-w-0">
      <span className="label-caps">{label}</span>
      <span className={cn("mono text-3xl font-semibold tracking-tight leading-none", tone ?? "text-text")}>{value}</span>
      <div className="text-xs text-text-mute mt-auto flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function SpentBar({ spent, budget }: { spent: number; budget: number | null }): ReactElement {
  const ratio = budget ? spent / budget : spent > 0 ? 1 : 0
  const over = budget != null && spent > budget
  return (
    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
      <div className={cn("h-full rounded-full", over ? "bg-loss" : budget == null ? "bg-text-mute" : "bg-long")} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  )
}

// §5.9 (artboard 04): presupuesto por categoría del mes. Se arrastra: sin el
// suyo, el mes usa el del último que lo tenga (budgetFrom). Las celdas se
// editan en local y "Save changes" guarda la foto completa del mes, que vale
// desde él en adelante; la página se monta de nuevo (key) al cambiar.
export function BudgetsView(props: {
  month:       string
  budgetFrom:  string | null          // mes del que viene el presupuesto vigente
  phase:       "past" | "current" | "next"
  rows:        BudgetRow[]
  totals:      BudgetTotals
  income:      number
  projection:  Projection | null
  history:     number                 // meses en los que se basa la media
  categories:  FinanceCategory[]
  monthSelect: ReactNode
}): ReactElement {
  const { month, budgetFrom, phase, rows, totals, income, projection, history, categories, monthSelect } = props
  const names = new Map(categories.map(c => [c.id, c.name]))
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(rows.filter(r => r.categoryId && !r.auto).map(r => [r.categoryId!, r.budget == null ? "" : String(r.budget)])),
  )
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [pending, startTransition] = useTransition()

  function showToast(message: string, variant: ToastVariant = "success") {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 3000)
  }

  // Filas con el presupuesto del borrador aplicado.
  const live = rows.map(r => {
    if (!r.categoryId || r.auto) return r
    const parsed = parseAmount(draft[r.categoryId] ?? "")
    const budget = parsed === undefined ? r.budget : parsed
    return { ...r, budget, left: budget == null ? null : Math.round((budget - r.spent) * 100) / 100, over: budget != null && r.spent > budget, projectedOver: budget != null && r.projected > budget }
  })
  const changed = rows.filter(r => r.categoryId && !r.auto && parseAmount(draft[r.categoryId] ?? "") !== undefined
    && parseAmount(draft[r.categoryId] ?? "") !== r.budget)
  const invalid = rows.some(r => r.categoryId && !r.auto && parseAmount(draft[r.categoryId] ?? "") === undefined)
  const totalBudget = Math.round(live.reduce((a, r) => a + (r.budget ?? 0), 0) * 100) / 100
  const over = live.filter(r => r.over).length
  const projectedOver = live.filter(r => !r.over && r.projectedOver).length
  const suggestable = live.filter(r => r.categoryId && !r.auto && r.budget == null && r.suggested != null)

  // Foto completa del mes: también las categorías no tocadas (vienen arrastradas).
  function save() {
    if (!changed.length || invalid) return
    const editable = rows.filter(r => r.categoryId && !r.auto)
    startTransition(async () => {
      const res = await saveBudgets({ month, amounts: editable.map(r => ({ categoryId: r.categoryId!, amount: parseAmount(draft[r.categoryId!] ?? "") ?? null })) })
      if (res.success) showToast(B.SAVED.replace("{month}", fmtMonth(month)))
      else showToast(moneyErrorMessage(res.error), "error")
    })
  }

  function applySuggestions() {
    setDraft(d => ({ ...d, ...Object.fromEntries(suggestable.map(r => [r.categoryId!, String(r.suggested)])) }))
  }

  const name = (r: BudgetRow) => (r.categoryId ? names.get(r.categoryId) ?? "—" : B.UNCATEGORIZED)
  const budgetCell = (r: BudgetRow, cls?: string) => r.categoryId && !r.auto ? (
    <input
      value={draft[r.categoryId] ?? ""} inputMode="decimal" placeholder={r.suggested != null ? String(r.suggested) : "—"}
      onChange={e => setDraft(d => ({ ...d, [r.categoryId!]: e.target.value }))}
      aria-label={B.BUDGET_LABEL.replace("{category}", name(r))}
      className={cn(
        "bg-surface-2 border rounded-sm px-2.5 py-1.5 text-sm text-text mono text-right outline-none focus:border-border-hi w-24 placeholder:text-text-mute/50",
        parseAmount(draft[r.categoryId] ?? "") === undefined || r.over ? "border-loss/60" : "border-border", cls,
      )}
    />
  ) : (
    <span className="mono text-sm text-text-mute">{r.budget == null ? "—" : fmtEur(r.budget)}</span>
  )
  const tag = (r: BudgetRow) => r.auto
    ? <span className="mono text-xs uppercase px-1.5 py-0.5 rounded-sm bg-surface-2 text-text-mute ml-2">{B.AUTO}</span>
    : r.isFixed ? <span className="mono text-xs uppercase px-1.5 py-0.5 rounded-sm bg-surface-2 text-text-mute ml-2">{B.FIXED}</span> : null

  const subtitle = phase === "current" && projection
    ? B.SUBTITLE.replace("{month}", monthName(month)).replace("{day}", String(projection.daysElapsed)).replace("{days}", String(projection.daysTotal))
    : (phase === "past" ? B.SUBTITLE_PAST : B.SUBTITLE_NEXT).replace("{month}", monthName(month))
  const headroom = totalBudget - totals.projected

  return (
    <div className="flex flex-col h-full">
      {toast && <div className="fixed top-4 right-4 z-50"><Toast variant={toast.variant} message={toast.message} /></div>}

      <header className="flex flex-wrap items-center gap-3 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-text">{B.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5 truncate">{subtitle}</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={save} disabled={pending || !changed.length || invalid} className="btn-accent inline-flex items-center gap-2 disabled:opacity-60">
            {pending && <Spinner />}{B.SAVE}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
        {over > 0 && <span className="mono text-xs font-semibold uppercase px-2 py-0.5 rounded-sm bg-loss/10 text-loss">{B.CHIP_OVER.replace("{n}", String(over))}</span>}
        {projectedOver > 0 && <span className="mono text-xs font-semibold uppercase px-2 py-0.5 rounded-sm bg-short/10 text-short">{B.CHIP_PROJECTED.replace("{n}", String(projectedOver))}</span>}
        <span className="text-xs text-text-mute">
          {budgetFrom == null ? B.FROM_NONE : budgetFrom === month ? B.FROM_THIS : B.FROM_EARLIER.replace("{month}", fmtMonth(budgetFrom))}
        </span>
        {changed.length > 0 && <span className="text-xs text-short">{B.UNSAVED.replace("{month}", fmtMonth(month))}</span>}
        {suggestable.length > 0 && (
          <button type="button" onClick={applySuggestions} className="btn-ghost px-2.5 py-1 text-xs">{B.APPLY_SUGGESTIONS}</button>
        )}
        <div className="ml-auto">{monthSelect}</div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto page-pad flex flex-col gap-3">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric label={B.TOTAL_BUDGET} value={fmtEur(totalBudget, { decimals: 0 })}>
            <span>{income > 0 ? B.TOTAL_SUB.replace("{income}", fmtEur(income, { decimals: 0 })).replace("{left}", fmtEur(income - totalBudget, { decimals: 0 })) : B.TOTAL_SUB_NONE}</span>
          </Metric>
          <Metric label={B.SPENT} value={fmtEur(totals.spent, { decimals: 0 })}>
            <SpentBar spent={totals.spent} budget={totalBudget || null} />
            <span>
              {totalBudget > 0 && (phase === "current" && projection
                ? B.SPENT_SUB.replace("{pct}", pct(totals.spent / totalBudget)).replace("{day}", String(projection.daysElapsed))
                    .replace("{days}", String(projection.daysTotal)).replace("{dayPct}", pct(projection.daysElapsed / projection.daysTotal))
                : B.SPENT_SUB_PAST.replace("{pct}", pct(totals.spent / totalBudget)))}
            </span>
          </Metric>
          <Metric label={B.PROJECTED} value={fmtEur(totals.projected, { decimals: 0 })} tone={totalBudget > 0 ? headroom >= 0 ? "text-profit" : "text-loss" : undefined}>
            {totalBudget > 0 && <span>{(headroom >= 0 ? B.PROJECTED_SUB : B.PROJECTED_OVER).replace("{amount}", fmtEur(Math.abs(headroom), { decimals: 0 }))}</span>}
          </Metric>
          <Metric label={B.AVG3} value={totals.avg3 == null ? "—" : fmtEur(totals.avg3, { decimals: 0 })}>
            <span>{history === 0 ? B.AVG3_NONE : history < 3 ? B.AVG3_SUB_FEW.replace("{n}", String(history)) : B.AVG3_SUB}</span>
          </Metric>
        </div>

        <div className="card p-0 overflow-x-auto">
          <table className="hidden md:table w-full border-collapse" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th className="label-caps px-3 py-2.5 border-b border-border text-left">{B.HEAD_CATEGORY}</th>
                <th className="label-caps px-3 py-2.5 border-b border-border text-left" style={{ width: 120 }}>{B.HEAD_BUDGET}</th>
                <th className="label-caps px-3 py-2.5 border-b border-border text-left" style={{ width: 220 }}>{B.HEAD_SPENT}</th>
                <th className="label-caps px-3 py-2.5 border-b border-border text-right" style={{ width: 100 }}>{B.HEAD_LEFT}</th>
                <th className="label-caps px-3 py-2.5 border-b border-border text-right" style={{ width: 110 }}>{B.HEAD_PROJECTED}</th>
                <th className="label-caps px-3 py-2.5 border-b border-border text-left" style={{ width: 170 }}>{B.HEAD_AVG3}</th>
              </tr>
            </thead>
            <tbody>
              {live.map(r => (
                <tr key={r.categoryId ?? "none"} className="border-b border-border hover:bg-surface-2">
                  <td className="px-3 py-2 text-sm font-medium text-text">{name(r)}{tag(r)}</td>
                  <td className="px-3 py-2">{budgetCell(r)}</td>
                  <td className="px-3 py-2">
                    <SpentBar spent={r.spent} budget={r.budget} />
                    <span className={cn("mono text-xs", r.over ? "text-loss" : "text-text-mute")}>
                      {fmtEur(r.spent)}{r.over && r.budget != null ? ` · +${fmtEur(r.spent - r.budget)}` : ""}
                    </span>
                  </td>
                  <td className={cn("px-3 py-2 mono text-sm text-right", r.left != null && r.left < 0 ? "text-loss" : "text-text")}>
                    {r.left == null ? "—" : fmtEur(r.left)}
                  </td>
                  <td className={cn("px-3 py-2 mono text-sm text-right", r.projectedOver ? r.over ? "text-loss" : "text-short" : "text-text")}>{fmtEur(r.projected)}</td>
                  <td className="px-3 py-2 mono text-sm text-text-mute">
                    {r.avg3 == null ? "—" : fmtEur(r.avg3)}
                    {r.suggested != null && r.suggested !== r.budget && <span className="text-xs"> · {B.SUGGEST.replace("{amount}", String(r.suggested))}</span>}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-2.5 text-sm font-semibold text-text">{B.TOTAL}</td>
                <td className="px-3 py-2.5 mono text-sm font-semibold text-text">{fmtEur(totalBudget)}</td>
                <td className="px-3 py-2.5 mono text-sm font-semibold text-text">{fmtEur(totals.spent)}</td>
                <td className={cn("px-3 py-2.5 mono text-sm font-semibold text-right", totalBudget - totals.spent < 0 ? "text-loss" : "text-text")}>{fmtEur(totalBudget - totals.spent)}</td>
                <td className={cn("px-3 py-2.5 mono text-sm font-semibold text-right", totalBudget > 0 && headroom < 0 ? "text-loss" : "text-profit")}>{fmtEur(totals.projected)}</td>
                <td className="px-3 py-2.5 mono text-sm text-text-mute">{totals.avg3 == null ? "—" : fmtEur(totals.avg3)}</td>
              </tr>
            </tbody>
          </table>

          {/* Móvil: una fila compacta por categoría. */}
          <div className="md:hidden">
            {live.map(r => (
              <div key={r.categoryId ?? "none"} className="flex flex-col gap-1.5 px-3 py-2.5 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="flex-1 min-w-0 text-sm font-medium text-text truncate">{name(r)}{tag(r)}</span>
                  {budgetCell(r)}
                </div>
                <SpentBar spent={r.spent} budget={r.budget} />
                <div className="flex items-center gap-2 text-xs mono text-text-mute">
                  <span className={r.over ? "text-loss" : ""}>{fmtEur(r.spent)}</span>
                  <span>· {B.HEAD_PROJECTED.toLowerCase()} <span className={r.projectedOver ? "text-short" : ""}>{fmtEur(r.projected)}</span></span>
                  {r.suggested != null && r.suggested !== r.budget && <span className="ml-auto">{B.SUGGEST.replace("{amount}", String(r.suggested))}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="card p-0">
            <div className="px-4 py-3 border-b border-border"><span className="label-caps">{B.HOW_TITLE}</span></div>
            <p className="px-4 py-3 text-xs text-text-mute">{B.HOW_BODY}</p>
          </div>
          <div className="card p-0">
            <div className="px-4 py-3 border-b border-border"><span className="label-caps">{B.SUGGEST_TITLE}</span></div>
            <p className="px-4 py-3 text-xs text-text-mute">{B.SUGGEST_BODY}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
