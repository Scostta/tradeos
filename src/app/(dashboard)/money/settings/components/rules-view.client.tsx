"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { deleteFinanceRule, updateFinanceRule } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { FinanceCategory, FinanceRule } from "~/types/finance"
import { cn } from "~/utils/cn"
import { CategorySelect } from "../../components/category-select.client"
import { fmtDay } from "../../components/money-format"
import { moneyErrorMessage } from "../../components/money-errors"

const S = MONEY.SETTINGS

// Las reglas de suscripción (§2.5) son las únicas con prioridad: las crea
// confirmar una suscripción, no el panel de un movimiento.
const isSubscriptionRule = (r: FinanceRule) => r.priority > 0

// §5.6 pestaña Rules: lista con lo que categoriza cada regla, cambio de
// categoría (mueve lo que categoriza) y borrado con confirmación en la propia
// fila (suelta sus movimientos, deleteFinanceRule).
export function RulesView({ rules, categories, counts }: {
  rules:      FinanceRule[]
  categories: FinanceCategory[]
  counts:     Record<string, number>
}): ReactElement {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [pending, startTransition] = useTransition()

  const sorted = [...rules].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || a.pattern.localeCompare(b.pattern))

  function showToast(message: string, variant: ToastVariant = "success") {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 3000)
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

  return (
    <div className="card p-0 max-w-4xl">
      {toast && <div className="fixed top-4 right-4 z-50"><Toast variant={toast.variant} message={toast.message} /></div>}

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
                  <td className="px-3 py-2.5 mono text-sm text-text">{r.pattern}</td>
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
                  <span className="flex-1 min-w-0 mono text-sm text-text truncate">{r.pattern}</span>
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
  )
}
