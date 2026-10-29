"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { createFinanceRule, deleteFinanceRule, updateFinanceRule } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { FinanceCategory, FinanceRule } from "~/types/finance"
import { cn } from "~/utils/cn"
import { CategorySelect } from "../../components/category-select.client"
import { fmtDay, fmtEur } from "../../components/money-format"
import { moneyErrorMessage } from "../../components/money-errors"

const S = MONEY.SETTINGS

// Las reglas de suscripción (§2.5) son las únicas con prioridad: las crea
// confirmar una suscripción, no el panel de un movimiento.
const isSubscriptionRule = (r: FinanceRule) => r.priority > 0

/** "500", "500,00" → 500; vacío → null (cualquier importe); undefined si no es válido. */
function parseAmount(s: string): number | null | undefined {
  if (!s.trim()) return null
  const n = Number(s.trim().replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

// §5.6 pestaña Rules: alta (patrón, importe exacto opcional, categoría), lista
// con lo que categoriza cada regla, cambio de categoría (mueve lo que
// categoriza) y borrado con confirmación en la propia fila (suelta sus
// movimientos, deleteFinanceRule).
export function RulesView({ rules, categories, counts }: {
  rules:      FinanceRule[]
  categories: FinanceCategory[]
  counts:     Record<string, number>
}): ReactElement {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ pattern: string; amount: string; categoryId: string | null }>({ pattern: "", amount: "", categoryId: null })
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [pending, startTransition] = useTransition()

  const sorted = [...rules].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || a.pattern.localeCompare(b.pattern))

  function showToast(message: string, variant: ToastVariant = "success") {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 3000)
  }

  const draftAmount = parseAmount(draft.amount)
  const canAdd = draft.pattern.trim().length >= 2 && draft.categoryId != null && draftAmount !== undefined

  function add() {
    if (!canAdd || pending) return
    startTransition(async () => {
      const res = await createFinanceRule({ pattern: draft.pattern, amount: draftAmount ?? null, categoryId: draft.categoryId })
      if (res.success) {
        setDraft({ pattern: "", amount: "", categoryId: null })
        showToast(S.RULE_ADDED.replace("{n}", String(res.data.applied)))
      } else showToast(moneyErrorMessage(res.error), "error")
    })
  }

  function remove(rule: FinanceRule) {
    startTransition(async () => {
      const res = await deleteFinanceRule({ ruleId: rule.id })
      setConfirming(null)
      if (res.success) showToast(S.DELETED.replace("{n}", String(res.data.released)))
      else showToast(moneyErrorMessage(res.error), "error")
    })
  }

  function changeCategory(rule: FinanceRule, categoryId: string | null) {
    if (!categoryId || categoryId === rule.categoryId) return
    startTransition(async () => {
      const res = await updateFinanceRule({ ruleId: rule.id, categoryId })
      if (res.success) showToast(S.RULE_UPDATED.replace("{n}", String(res.data.applied)))
      else showToast(moneyErrorMessage(res.error), "error")
    })
  }

  const category = (r: FinanceRule) => (
    <CategorySelect categories={categories} value={r.categoryId} allowEmpty={false} onChange={id => changeCategory(r, id)} />
  )

  const origin = (r: FinanceRule) => isSubscriptionRule(r) ? S.ORIGIN_SUBSCRIPTION : S.ORIGIN_MANUAL.replace("{date}", fmtDay(r.createdAt.slice(0, 10)))

  const actions = (r: FinanceRule) => confirming === r.id ? (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-text-dim">{S.CONFIRM_DELETE}</span>
      <button type="button" disabled={pending} onClick={() => remove(r)} className="btn-ghost px-2.5 py-1 text-xs text-loss border-loss/40 disabled:opacity-60">{S.YES}</button>
      <button type="button" disabled={pending} onClick={() => setConfirming(null)} className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-60">{S.NO}</button>
    </span>
  ) : (
    <button type="button" onClick={() => setConfirming(r.id)} className="btn-ghost px-2.5 py-1 text-xs">{S.DELETE}</button>
  )

  const pattern = (r: FinanceRule) => (
    <>
      {r.pattern}
      {r.amount != null && <span className="ml-2 text-xs text-text-dim bg-surface-2 border border-border rounded-sm px-1.5 py-0.5">= {fmtEur(r.amount)}</span>}
    </>
  )

  return (
    <div className="flex flex-col gap-3">
      {toast && <div className="fixed top-4 right-4 z-50"><Toast variant={toast.variant} message={toast.message} /></div>}

      <form onSubmit={e => { e.preventDefault(); add() }} className="card px-4 py-3 flex flex-col gap-3">
        <span className="label-caps">{S.NEW_RULE}</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={draft.pattern} onChange={e => setDraft(d => ({ ...d, pattern: e.target.value }))} maxLength={100}
            placeholder={S.PATTERN_PLACEHOLDER} aria-label={S.HEAD_PATTERN} className={cn(INPUT_CLS, "mono flex-1 min-w-40 basis-0")}
          />
          <div className="w-36 shrink-0">
            <input
              value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} inputMode="decimal"
              placeholder={S.AMOUNT_PLACEHOLDER} aria-label={S.HEAD_AMOUNT} className={cn(INPUT_CLS, "mono", draftAmount === undefined && "border-loss/60")}
            />
          </div>
          <div className="w-48 shrink-0">
            <CategorySelect categories={categories} value={draft.categoryId} onChange={id => setDraft(d => ({ ...d, categoryId: id }))} />
          </div>
          <button type="submit" disabled={pending || !canAdd} className="btn-accent disabled:opacity-60">{S.ADD}</button>
        </div>
        <p className="text-xs text-text-mute">{S.NEW_RULE_HINT}</p>
      </form>

      <div className="card p-0">
        <div className="px-4 py-3 border-b border-border flex flex-col gap-1">
          <span className="label-caps">{S.RULES_TITLE.replace("{n}", String(rules.length))}</span>
          <p className="text-xs text-text-mute">{S.RULES_HINT}</p>
        </div>

        {sorted.length === 0 ? (
          <div className="px-4 py-14 text-center text-sm text-text-mute">{S.RULES_EMPTY}</div>
        ) : (
          <>
            <table className="hidden md:table w-full border-collapse">
              <thead>
                <tr>
                  <th className="label-caps px-3 py-2.5 border-b border-border text-left">{S.HEAD_PATTERN}</th>
                  <th className="label-caps px-3 py-2.5 border-b border-border text-left">{S.HEAD_CATEGORY}</th>
                  <th className="label-caps px-3 py-2.5 border-b border-border text-right">{S.HEAD_COUNT}</th>
                  <th className="label-caps px-3 py-2.5 border-b border-border text-left">{S.HEAD_ORIGIN}</th>
                  <th className="border-b border-border" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-2.5 mono text-sm text-text">{pattern(r)}</td>
                    <td className="px-3 py-1.5" style={{ width: 200 }}>{category(r)}</td>
                    <td className={cn("px-3 py-2.5 mono text-sm text-right", counts[r.id] ? "text-text" : "text-text-mute")}>{counts[r.id] ?? 0}</td>
                    <td className="px-3 py-2.5 text-sm text-text-dim whitespace-nowrap">{origin(r)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="md:hidden">
              {sorted.map(r => (
                <div key={r.id} className="flex flex-col gap-1.5 px-3 py-2.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 min-w-0 mono text-sm text-text truncate">{pattern(r)}</span>
                    {actions(r)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-mute min-w-0">
                    <div className="w-44 shrink-0">{category(r)}</div>
                    <span className="mono whitespace-nowrap">{S.COUNT.replace("{n}", String(counts[r.id] ?? 0))}</span>
                    <span className="truncate">· {origin(r)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
