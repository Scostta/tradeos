"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { archiveGoal, updateGoal } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"
import { Spinner } from "~/lib/ui/spinner"
import type { FinanceGoal } from "~/types/finance"
import { cn } from "~/utils/cn"
import { fmtEur } from "../../components/money-format"
import { moneyErrorMessage } from "../../components/money-errors"
import { monthToDeadline, parseAmount } from "./goal-style"

const G = MONEY.GOALS

// Editar un objetivo: nombre, meta, aportación, prioridad y fecha límite.
// Lo ahorrado no se edita: solo crece al cerrar un mes (§4.5).
export function GoalEditModal({ goal, onClose }: { goal: FinanceGoal; onClose: () => void }): ReactElement {
  const [name, setName] = useState(goal.name)
  const [target, setTarget] = useState(String(goal.targetAmount))
  const [monthly, setMonthly] = useState(String(goal.monthlyAlloc))
  const [priority, setPriority] = useState(String(goal.priority))
  const [deadlineMonth, setDeadlineMonth] = useState(goal.deadline?.slice(0, 7) ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const targetAmount = parseAmount(target)
  const monthlyAlloc = parseAmount(monthly)
  const prio = Number(priority)
  const valid = name.trim().length > 0 && targetAmount != null && targetAmount > 0 && monthlyAlloc != null
    && Number.isInteger(prio) && prio >= 1 && prio <= 99

  function save() {
    if (!valid || pending) return
    startTransition(async () => {
      const res = await updateGoal({
        goalId: goal.id, name: name.trim(), targetAmount, monthlyAlloc, priority: prio, deadline: monthToDeadline(deadlineMonth),
      })
      if (res.success) onClose()
      else setError(moneyErrorMessage(res.error))
    })
  }

  function archive() {
    if (pending) return
    startTransition(async () => {
      const res = await archiveGoal({ goalId: goal.id })
      if (res.success) onClose()
      else setError(moneyErrorMessage(res.error))
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form
        onSubmit={e => { e.preventDefault(); save() }}
        className="card p-5 flex flex-col gap-4 w-full" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}
      >
        <div>
          <div className="text-lg font-semibold text-text">{G.EDIT_TITLE}</div>
          <p className="text-sm text-text-mute mt-0.5">{G.SAVED_FIXED.replace("{saved}", fmtEur(goal.savedAmount))}</p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="label-caps">{G.NAME}</span>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} className={INPUT_CLS} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 min-w-0">
            <span className="label-caps">{G.TARGET}</span>
            <input value={target} onChange={e => setTarget(e.target.value)} inputMode="decimal" className={cn(INPUT_CLS, "mono")} />
          </label>
          <label className="flex flex-col gap-1 min-w-0">
            <span className="label-caps">{G.MONTHLY_EDIT}</span>
            <input value={monthly} onChange={e => setMonthly(e.target.value)} inputMode="decimal" className={cn(INPUT_CLS, "mono")} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 min-w-0">
            <span className="label-caps">{G.PRIORITY}</span>
            <input value={priority} onChange={e => setPriority(e.target.value)} inputMode="numeric" className={cn(INPUT_CLS, "mono")} />
          </label>
          <label className="flex flex-col gap-1 min-w-0">
            <span className="label-caps">{G.DEADLINE}</span>
            <input type="month" value={deadlineMonth} onChange={e => setDeadlineMonth(e.target.value)} className={cn(INPUT_CLS, "mono")} />
          </label>
        </div>
        <p className="text-xs text-text-mute -mt-2">{G.PRIORITY_HINT}</p>

        {error && <div className="text-sm text-loss">{error}</div>}

        <div className="flex items-center gap-2">
          <button
            type="button" onClick={archive} disabled={pending}
            className="btn-ghost hover:border-loss hover:text-loss transition-colors disabled:opacity-60"
          >
            {G.ARCHIVE}
          </button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">{G.CANCEL}</button>
            <button type="submit" disabled={!valid || pending} className="btn-accent inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {pending && <Spinner />}{G.SAVE}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
