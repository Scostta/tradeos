"use client"

import { useState, useTransition } from "react"
import type { ReactElement, ReactNode } from "react"
import { closeInvestPosition } from "~/actions/invest"
import { INVEST } from "~/constants/copies/invest"
import { closeInvestPositionInputSchema } from "~/types/invest"
import type { ExitReason } from "~/types/invest"
import { Toast } from "~/lib/ui/toast"
import { TriangleAlertIcon } from "~/lib/ui/icons/triangle-alert-icon"
import { cn } from "~/utils/cn"
import { investErrorMessage } from "../../components/invest-errors"
import { Modal } from "../../components/modal.client"
import { INPUT_CLS } from "../../components/settings-form.client"
import { Spinner } from "../../components/spinner"

const C = INVEST.CLOSE
const REASONS: ExitReason[] = ["sma_exit", "falsifier", "manual"]

export type ClosablePosition = {
  id:         string
  ticker:     string
  currency:   string | null
  openedAt:   string
  falsifiers: string[]
  sellSignal: boolean
  lastPrice:  number | null
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-caps">{label}</span>
      {children}
    </div>
  )
}

type Props = {
  position: ClosablePosition
  onClose:  () => void
  onClosed: () => void
}

export function ClosePositionModal({ position: p, onClose, onClosed }: Props): ReactElement {
  const today = new Date().toISOString().slice(0, 10)
  // §4.3: precargado sma_exit si la señal del último check es sell.
  const [reason, setReason]       = useState<ExitReason>(p.sellSignal ? "sma_exit" : "falsifier")
  const [closedAt, setClosedAt]   = useState(today)
  const [price, setPrice]         = useState("")
  const [fees, setFees]           = useState("0")
  const [falsifier, setFalsifier] = useState<number | null>(null)
  const [note, setNote]           = useState("")
  const [error, setError]         = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // falsifier: la nota es el falsador elegido (+ comentario opcional).
  const exitNote =
    reason === "falsifier"
      ? falsifier == null ? "" : [p.falsifiers[falsifier], note.trim()].filter(Boolean).join("\n\n")
      : note.trim()

  const input = {
    positionId: p.id,
    closedAt,
    exitPrice:  Number(price),
    feesClose:  Number(fees || 0),
    exitReason: reason,
    exitNote:   exitNote || null,
  }
  const valid = closeInvestPositionInputSchema.safeParse(input).success && closedAt >= p.openedAt

  function submit() {
    if (!valid || pending) return
    startTransition(async () => {
      const result = await closeInvestPosition(input)
      if (result.success) {
        onClosed()
      } else {
        setError(investErrorMessage(result.error))
        setTimeout(() => setError(null), 5000)
      }
    })
  }

  return (
    <Modal title={`${C.TITLE} · ${p.ticker}`} width={560} onClose={onClose}>
      {error && (
        <div className="fixed top-4 right-4 z-60">
          <Toast variant="error" message={error} />
        </div>
      )}

      <Field label={C.REASON}>
        <div className="grid grid-cols-3 gap-1.5">
          {REASONS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "text-sm py-2 rounded-sm border transition-colors",
                reason === r
                  ? r === "manual" ? "border-short text-text bg-surface-2" : "border-accent text-text bg-surface-2"
                  : "border-border text-text-mute hover:border-border-hi",
              )}
            >
              {INVEST.POSITIONS.REASONS[r]}
            </button>
          ))}
        </div>
        {p.sellSignal && reason === "sma_exit" && (
          <span className="text-sm text-text-mute">{C.SELL_PRELOADED}</span>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label={C.DATE}>
          <input
            type="date" value={closedAt} min={p.openedAt} max={today}
            onChange={e => setClosedAt(e.target.value)} className={`${INPUT_CLS} mono`}
          />
        </Field>
        <Field label={C.PRICE.replace("{currency}", p.currency ?? "—")}>
          <input
            type="number" min="0" step="any" inputMode="decimal" value={price}
            placeholder={p.lastPrice != null ? String(p.lastPrice) : undefined}
            onChange={e => setPrice(e.target.value)} className={`${INPUT_CLS} mono`}
          />
        </Field>
        <Field label={C.FEES}>
          <input
            type="number" min="0" step="0.01" inputMode="decimal" value={fees}
            onChange={e => setFees(e.target.value)} className={`${INPUT_CLS} mono`}
          />
        </Field>
      </div>

      {reason === "falsifier" && (
        <Field label={C.WHICH_FALSIFIER}>
          <div className="flex flex-col gap-1.5">
            {p.falsifiers.map((f, i) => (
              <label
                key={i}
                className={cn(
                  "flex items-start gap-2.5 px-3 py-2 rounded-sm border cursor-pointer text-sm transition-colors",
                  falsifier === i ? "border-accent bg-surface-2 text-text" : "border-border text-text-dim hover:border-border-hi",
                )}
              >
                <input
                  type="radio" name="falsifier" checked={falsifier === i}
                  onChange={() => setFalsifier(i)} className="mt-0.5" style={{ accentColor: "var(--color-accent)" }}
                />
                {f}
              </label>
            ))}
          </div>
        </Field>
      )}

      {reason === "manual" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-sm border border-short/30 bg-short/10 text-short text-sm">
          <TriangleAlertIcon />
          {C.MANUAL_WARNING}
        </div>
      )}

      <Field label={reason === "manual" ? C.MANUAL_NOTE : C.NOTE_OPTIONAL}>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className={`${INPUT_CLS} resize-y`} />
      </Field>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">{C.CANCEL}</button>
        <button
          type="button" onClick={submit} disabled={!valid || pending}
          className="inline-flex items-center gap-2 px-4.5 py-2 rounded-sm bg-loss text-bg text-xs font-semibold hover:bg-loss/90 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? <><Spinner />{C.SUBMITTING}</> : C.SUBMIT}
        </button>
      </div>
    </Modal>
  )
}
