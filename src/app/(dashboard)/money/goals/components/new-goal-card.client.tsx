"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { createGoal } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { goalEta, requiredMonthly } from "~/lib/finance/allocate-savings"
import type { MonthKey } from "~/lib/finance/dates"
import { INPUT_CLS } from "~/lib/ui/form"
import { Spinner } from "~/lib/ui/spinner"
import { cn } from "~/utils/cn"
import { fmtEur, fmtMonth } from "../../components/money-format"
import { moneyErrorMessage } from "../../components/money-errors"
import { monthToDeadline, parseAmount } from "./goal-style"

const G = MONEY.GOALS

// Formulario "New goal" (artboard 05): nombre, importe y fecha límite opcional.
// La aportación mensual, si no se escribe, es la que pide la fecha límite o lo
// que queda libre del ahorro de este mes.
export function NewGoalCard({ free, openMonth }: { free: number; openMonth: MonthKey }): ReactElement {
  const [name, setName] = useState("")
  const [target, setTarget] = useState("")
  const [monthly, setMonthly] = useState("")
  const [deadlineMonth, setDeadlineMonth] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const targetAmount = parseAmount(target)
  const deadline = monthToDeadline(deadlineMonth)
  const typedMonthly = parseAmount(monthly)
  const needs = targetAmount && deadline ? requiredMonthly({ targetAmount, savedAmount: 0, deadline }, openMonth) : null
  const monthlyAlloc = typedMonthly ?? needs ?? free
  const valid = name.trim().length > 0 && targetAmount != null && targetAmount > 0 && (monthly.trim() === "" || typedMonthly != null)

  let hint: string = G.FORM_HINT.replace("{free}", fmtEur(free, { decimals: 0 }))
  if (targetAmount && targetAmount > 0) {
    const parts: string[] = []
    if (needs != null && deadline) parts.push(G.HINT_NEEDS.replace("{date}", fmtMonth(deadline.slice(0, 7))).replace("{amount}", fmtEur(needs, { decimals: 0 })))
    if (monthlyAlloc > 0 && (typedMonthly != null || needs == null)) {
      const eta = goalEta({ id: "new", targetAmount, savedAmount: 0, monthlyAlloc, priority: 99, deadline, status: "active" }, openMonth)
      if (eta.month) {
        parts.push((eta.tight ? G.HINT_TIGHT : G.HINT_ETA)
          .replace("{amount}", fmtEur(monthlyAlloc, { decimals: 0 })).replace("{date}", fmtMonth(eta.month)))
      }
    }
    if (parts.length === 0) parts.push(G.HINT_NO_FREE)
    hint = parts.join(" ")
  }

  function reset() {
    setName(""); setTarget(""); setMonthly(""); setDeadlineMonth(""); setError(null)
  }

  function submit() {
    if (!valid || pending) return
    startTransition(async () => {
      const res = await createGoal({ name: name.trim(), targetAmount, monthlyAlloc: Math.round(monthlyAlloc * 100) / 100, deadline })
      if (res.success) reset()
      else setError(moneyErrorMessage(res.error))
    })
  }

  return (
    <form
      id="new-goal"
      onSubmit={e => { e.preventDefault(); submit() }}
      className="rounded-md border border-dashed border-border-hi p-4 flex flex-col gap-3 min-w-0 scroll-mt-4"
    >
      <div>
        <div className="text-md font-semibold text-text">{G.NEW}</div>
        <p className={cn("text-sm mt-1", targetAmount ? "text-text-dim" : "text-text-mute")}>{hint}</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="label-caps">{G.NAME}</span>
        <input id="new-goal-name" value={name} onChange={e => setName(e.target.value)} maxLength={60} className={INPUT_CLS} />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1 min-w-0">
          <span className="label-caps">{G.TARGET}</span>
          <input value={target} onChange={e => setTarget(e.target.value)} inputMode="decimal" placeholder="€" className={cn(INPUT_CLS, "mono")} />
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="label-caps">{G.MONTHLY_FIELD}</span>
          <input
            value={monthly} onChange={e => setMonthly(e.target.value)} inputMode="decimal"
            placeholder={monthlyAlloc > 0 ? String(Math.round(monthlyAlloc)) : "€"} className={cn(INPUT_CLS, "mono")}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="label-caps">{G.DEADLINE}</span>
        <input type="month" value={deadlineMonth} min={openMonth} onChange={e => setDeadlineMonth(e.target.value)} className={cn(INPUT_CLS, "mono")} />
      </label>

      {error && <div className="text-sm text-loss">{error}</div>}

      <div className="flex gap-2">
        <button type="submit" disabled={!valid || pending} className="btn-accent inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
          {pending && <Spinner />}{G.CREATE}
        </button>
        <button type="button" onClick={reset} className="btn-ghost">{G.CANCEL}</button>
      </div>
    </form>
  )
}
