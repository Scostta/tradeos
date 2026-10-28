"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { splitTransaction } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"
import { Spinner } from "~/lib/ui/spinner"
import type { FinanceCategory, FinanceTransaction } from "~/types/finance"
import { cn } from "~/utils/cn"
import { CategorySelect } from "../../components/category-select.client"
import { displayName, fmtEur } from "../../components/money-format"
import { moneyErrorMessage } from "../../components/money-errors"

const T = MONEY.TRANSACTIONS

type Part = { categoryId: string | null; amount: string }

const cents = (s: string) => Math.round(Number(s.replace(",", ".")) * 100)

// §5.2 Split: N partes (categoría + importe) que suman el original. Los
// importes van con el mismo signo que el movimiento (un gasto se divide en gastos).
export function SplitModal({ transaction: t, categories, onClose, onDone }: {
  transaction: FinanceTransaction
  categories:  FinanceCategory[]
  onClose:     () => void
  onDone:      () => void
}): ReactElement {
  const sign = t.amount < 0 ? -1 : 1
  const half = Math.round(Math.abs(t.amount) * 50) / 100
  const [parts, setParts] = useState<Part[]>([
    { categoryId: t.categoryId, amount: half.toFixed(2) },
    { categoryId: null, amount: (Math.abs(t.amount) - half).toFixed(2) },
  ])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const total = Math.round(Math.abs(t.amount) * 100)
  const used = parts.reduce((a, p) => a + (Number.isFinite(cents(p.amount)) ? cents(p.amount) : 0), 0)
  const remaining = total - used
  const valid = remaining === 0 && parts.every(p => p.categoryId && cents(p.amount) > 0)

  function update(i: number, patch: Partial<Part>) {
    setParts(list => list.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  }

  function save() {
    if (!valid || pending) return
    startTransition(async () => {
      const res = await splitTransaction({
        transactionId: t.id,
        parts: parts.map(p => ({ categoryId: p.categoryId!, amount: (sign * cents(p.amount)) / 100 })),
      })
      if (res.success) onDone()
      else setError(moneyErrorMessage(res.error))
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card p-5 flex flex-col gap-4 w-full" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div>
          <div className="text-lg font-semibold text-text">{T.SPLIT_TITLE}</div>
          <div className="text-sm text-text-mute mt-0.5">
            {displayName(t.counterparty)} · <span className="mono">{fmtEur(t.amount)}</span>
          </div>
          <p className="text-sm text-text-dim mt-2">{T.SPLIT_HINT.replace("{total}", fmtEur(Math.abs(t.amount)))}</p>
        </div>

        <div className="flex flex-col gap-2">
          {parts.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <CategorySelect categories={categories} value={p.categoryId} onChange={id => update(i, { categoryId: id })} />
              </div>
              <input
                value={p.amount} onChange={e => update(i, { amount: e.target.value })}
                inputMode="decimal" className={`${INPUT_CLS} mono text-right`} style={{ width: 110 }}
              />
              {parts.length > 2 && (
                <button type="button" onClick={() => setParts(list => list.filter((_, j) => j !== i))} className="text-xs text-text-mute hover:text-loss">
                  {T.REMOVE}
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              type="button" onClick={() => setParts(list => [...list, { categoryId: null, amount: (Math.max(remaining, 0) / 100).toFixed(2) }])}
              disabled={parts.length >= 10} className="text-sm text-text-dim hover:text-accent"
            >
              + {T.SPLIT_ADD}
            </button>
            <span className={cn("mono text-sm", remaining === 0 ? "text-profit" : "text-short")}>
              {T.SPLIT_REMAINING} {fmtEur(remaining / 100)}
            </span>
          </div>
        </div>

        {error && <div className="text-sm text-loss">{error}</div>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">{T.CANCEL}</button>
          <button
            type="button" onClick={save} disabled={!valid || pending}
            className="btn-accent inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending && <Spinner />}{T.SPLIT_SAVE}
          </button>
        </div>
      </div>
    </div>
  )
}
