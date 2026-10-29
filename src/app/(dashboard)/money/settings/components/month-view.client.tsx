"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { closeCurrentMonth, setMonthStartDay } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import { fmtMonth } from "../../components/money-format"
import { moneyErrorMessage } from "../../components/money-errors"

const S = MONEY.SETTINGS
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

// §5.6 pestaña Month: día de inicio del mes y "Close month" manual (§4.5) del
// mes en curso, con confirmación en línea porque no se puede deshacer.
export function MonthView({ monthStartDay, closedThrough, current }: {
  monthStartDay: number
  closedThrough: string | null
  current:       string             // mes en curso (YYYY-MM) con el día de inicio actual
}): ReactElement {
  const [day, setDay] = useState(monthStartDay)
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [pending, startTransition] = useTransition()

  const closed = closedThrough != null && closedThrough >= current

  function showToast(message: string, variant: ToastVariant = "success") {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 3000)
  }

  function saveDay() {
    startTransition(async () => {
      const res = await setMonthStartDay({ monthStartDay: day })
      if (res.success) showToast(S.MONTH_SAVED)
      else showToast(moneyErrorMessage(res.error), "error")
    })
  }

  function close() {
    startTransition(async () => {
      const res = await closeCurrentMonth()
      setConfirming(false)
      if (res.success) showToast(S.CLOSED_DONE.replace("{month}", fmtMonth(current)))
      else showToast(moneyErrorMessage(res.error), "error")
    })
  }

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      {toast && <div className="fixed top-4 right-4 z-50"><Toast variant={toast.variant} message={toast.message} /></div>}

      <div className="card px-4 py-3 flex flex-col gap-3">
        <span className="label-caps">{S.MONTH_START}</span>
        <div className="flex items-center gap-2">
          <div className="w-24">
            <select value={day} onChange={e => setDay(Number(e.target.value))} aria-label={S.MONTH_START} className={`${INPUT_CLS} mono`}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button type="button" onClick={saveDay} disabled={pending || day === monthStartDay} className="btn-accent disabled:opacity-60">{S.SAVE}</button>
        </div>
        <p className="text-xs text-text-mute">{S.MONTH_START_HINT}</p>
      </div>

      <div className="card px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="label-caps">{S.CLOSE_TITLE}</span>
          <span className="mono text-xs text-text-mute">
            {closedThrough ? S.CLOSED_THROUGH.replace("{month}", fmtMonth(closedThrough)) : S.NOTHING_CLOSED}
          </span>
        </div>
        <p className="text-xs text-text-mute">{S.CLOSE_BODY}</p>
        {!closed && (confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-dim">{S.CLOSE_CONFIRM.replace("{month}", fmtMonth(current))}</span>
            <button type="button" onClick={close} disabled={pending} className="btn-ghost text-loss border-loss/40 disabled:opacity-60">{S.YES}</button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="btn-ghost disabled:opacity-60">{S.NO}</button>
          </div>
        ) : (
          <div>
            <button type="button" onClick={() => setConfirming(true)} className="btn-ghost">{S.CLOSE_NOW.replace("{month}", fmtMonth(current))}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
