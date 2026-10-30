"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { addManualTransaction } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { defaultManualAccount, quickCategories } from "~/lib/finance/cash"
import type { ManualDirection } from "~/lib/finance/cash"
import { INPUT_CLS } from "~/lib/ui/form"
import { Spinner } from "~/lib/ui/spinner"
import type { FinanceAccount, FinanceCategory } from "~/types/finance"
import { cn } from "~/utils/cn"
import { CategorySelect } from "./category-select.client"
import { fmtEur } from "./money-format"
import { moneyErrorMessage } from "./money-errors"

const C = MONEY.CASH

/** "12", "12,5", "12.50" → número > 0; null si no es válido. */
function parseCash(s: string): number | null {
  const n = Number(s.trim().replace(",", "."))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

// §5.7 M2: gasto o ingreso, importe, categoría (chips de las más usadas +
// "More…"), cuenta (gasto → Cash, ingreso → la cuenta por defecto), concepto
// opcional y fecha (hoy). Crea un movimiento manual ya categorizado.
export function CashForm({ categories, usage, accounts, defaultAccountId, today, onClose, onSaved }: {
  categories:       FinanceCategory[]
  usage:            string[]          // categorías por uso, las más usadas primero
  accounts:         FinanceAccount[]
  defaultAccountId: string | null
  today:            string
  onClose:          () => void
  onSaved:          (message: string) => void
}): ReactElement {
  const activeAccounts = accounts.filter(a => a.active)
  const [direction, setDirection] = useState<ManualDirection>("expense")
  const chips = quickCategories(categories, usage, 5, direction)
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(chips[0]?.id ?? null)
  const [accountId, setAccountId] = useState<string | null>(defaultManualAccount(accounts, "expense", defaultAccountId)?.id ?? null)
  const [more, setMore] = useState(false)
  const [concept, setConcept] = useState("")
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const value = parseCash(amount)
  const valid = value != null && categoryId != null && /^\d{4}-\d{2}-\d{2}$/.test(date)
  const inChips = chips.some(c => c.id === categoryId)

  function switchTo(next: ManualDirection) {
    if (next === direction) return
    setDirection(next)
    setCategoryId(quickCategories(categories, usage, 1, next)[0]?.id ?? null)
    setAccountId(defaultManualAccount(accounts, next, defaultAccountId)?.id ?? null)
    setMore(false)
    setError(null)
  }

  function save() {
    if (!valid || pending) return
    startTransition(async () => {
      const res = await addManualTransaction({ direction, amount: value, categoryId, accountId, concept: concept.trim() || null, date })
      if (res.success) {
        const name = categories.find(c => c.id === categoryId)?.name ?? ""
        onSaved(C.SAVED.replace("{amount}", fmtEur(value)).replace("{category}", name))
      }
      else setError(moneyErrorMessage(res.error))
    })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); save() }} className="flex flex-col gap-4">
      <div className="flex items-start gap-2.5">
        <div>
          <div className="text-lg font-semibold tracking-tight text-text">{C.TITLE}</div>
          <div className="text-xs text-text-mute mt-0.5">{C.SUBTITLE}</div>
        </div>
        <button type="button" onClick={onClose} aria-label={C.CLOSE} className="ml-auto p-1 text-text-mute hover:text-text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
        {(["expense", "income"] as const).map(d => (
          <button
            key={d} type="button" role="radio" aria-checked={direction === d} onClick={() => switchTo(d)}
            className={cn(
              "py-2 rounded-sm border text-sm",
              direction === d
                ? d === "expense" ? "bg-loss/10 border-loss text-loss font-semibold" : "bg-profit/10 border-profit text-profit font-semibold"
                : "bg-surface-2 border-border text-text-dim",
            )}
          >
            {d === "expense" ? C.EXPENSE : C.INCOME}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="label-caps">{C.AMOUNT}</span>
        <input
          value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus
          className={cn(INPUT_CLS, "mono text-3xl font-semibold tracking-tight py-2.5")}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="label-caps">{C.CATEGORY}</span>
        {chips.length === 0 && (
          <div className="text-xs text-text-mute">{C.NO_CATEGORIES.replace("{kind}", direction === "expense" ? C.EXPENSE.toLowerCase() : C.INCOME.toLowerCase())}</div>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {chips.map(c => (
            <button
              key={c.id} type="button" onClick={() => { setCategoryId(c.id); setMore(false) }}
              className={cn(
                "py-2 rounded-sm border text-sm truncate px-1",
                categoryId === c.id ? "bg-accent/10 border-accent text-accent font-semibold" : "bg-surface-2 border-border text-text-dim",
              )}
            >
              {c.name}
            </button>
          ))}
          <button
            type="button" onClick={() => setMore(true)}
            className={cn(
              "py-2 rounded-sm border text-sm",
              more || (categoryId && !inChips) ? "bg-accent/10 border-accent text-accent font-semibold" : "bg-surface-2 border-border text-text-mute",
            )}
          >
            {C.MORE}
          </button>
        </div>
        {(more || (categoryId != null && !inChips)) && (
          <CategorySelect
            categories={categories.filter(c => c.kind === direction)} value={categoryId}
            onChange={setCategoryId} allowEmpty={false}
          />
        )}
      </div>

      {activeAccounts.length > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">{C.ACCOUNT}</span>
          <select value={accountId ?? ""} onChange={e => setAccountId(e.target.value || null)} className={INPUT_CLS}>
            {activeAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}{a.ibanLast4 ? ` ••${a.ibanLast4}` : ""}</option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "1fr 140px" }}>
        <label className="flex flex-col gap-1.5 min-w-0">
          <span className="label-caps">{C.CONCEPT}</span>
          <input value={concept} onChange={e => setConcept(e.target.value)} maxLength={100} placeholder={C.CONCEPT_PLACEHOLDER} className={INPUT_CLS} />
        </label>
        <label className="flex flex-col gap-1.5 min-w-0">
          <span className="label-caps">{C.DATE}</span>
          <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className={cn(INPUT_CLS, "mono")} />
        </label>
      </div>

      {error && <div className="text-sm text-loss">{error}</div>}

      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="btn-ghost flex-1">{C.CANCEL}</button>
        <button
          type="submit" disabled={!valid || pending}
          className="btn-accent inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ flex: 2 }}
        >
          {pending && <Spinner />}{C.SAVE}
        </button>
      </div>
    </form>
  )
}
