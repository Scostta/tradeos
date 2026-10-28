"use client"

import { useState, useTransition } from "react"
import type { ReactElement, ReactNode } from "react"
import { openInvestPosition } from "~/actions/invest"
import { INVEST } from "~/constants/copies/invest"
import { positionSizeWarning, suggestedPositionSize } from "~/lib/calculations/invest-sizing"
import { thesisFromDraft } from "~/lib/calculations/invest-detail"
import {
  FALSIFIER_MIN_LENGTH,
  MIN_FALSIFIERS,
  THESIS_MIN_LENGTH,
  openInvestPositionInputSchema,
} from "~/types/invest"
import type { ThesisAnswers } from "~/types/invest"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import { cn } from "~/utils/cn"
import { fmtDay, fmtPct } from "./invest-format"
import { investErrorMessage } from "./invest-errors"
import { Modal } from "./modal.client"
import { INPUT_CLS } from "~/lib/ui/form"
import { Spinner } from "~/lib/ui/spinner"

const O = INVEST.OPEN

export type OpenCandidate = {
  ticker:              string
  name:                string | null
  currency:            string | null
  price:               number | null     // cierre del run, para precargar
  runDate:             string
  totalPortfolioValue: number
  positionPct:         number
  eurPerUnit:          number | null     // null: sin FX del run → no se calculan acciones
  paper:               boolean           // modo papel (§1.6): la posición se crea con paper = true
  draft:               ThesisAnswers | null  // borrador de "Thesis prompts" (§4.7) para precargar
}

const eur = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-caps">{label}</span>
      {children}
      {hint && <span className="text-sm text-text-mute">{hint}</span>}
    </div>
  )
}

function Counter({ n, min }: { n: number; min: number }): ReactElement {
  return (
    <span className={cn("mono text-xs", n >= min ? "text-profit" : "text-text-mute")}>
      {O.CHARS.replace("{n}", String(n)).replace("{min}", String(min))}
    </span>
  )
}

type Props = {
  candidate: OpenCandidate
  onClose:   () => void
  onOpened:  () => void
}

export function OpenPositionModal({ candidate: c, onClose, onOpened }: Props): ReactElement {
  const today = new Date().toISOString().slice(0, 10)
  const currency = c.currency ?? "—"
  const size = (price: number) =>
    suggestedPositionSize({ totalPortfolioValue: c.totalPortfolioValue, positionPct: c.positionPct }, price, c.eurPerUnit ?? 1)

  const initialShares = c.price != null && c.eurPerUnit != null ? size(c.price).shares : null
  const [openedAt, setOpenedAt]     = useState(today)
  const [price, setPrice]           = useState(c.price != null ? String(c.price) : "")
  const [shares, setShares]         = useState(initialShares ? String(initialShares) : "")
  const [sharesTouched, setTouched] = useState(false)
  const [fees, setFees]             = useState("0")
  // §4.7: precarga desde el borrador de "Thesis prompts" (tesis = las cuatro
  // respuestas, falsadores = la 2 y la 4). La validación no cambia.
  const prefill = c.draft ? thesisFromDraft(c.draft, INVEST.DETAIL.PROMPTS) : null
  const [thesis, setThesis]         = useState(prefill?.thesis ?? "")
  const [falsifiers, setFalsifiers] = useState<string[]>(prefill?.falsifiers ?? Array(MIN_FALSIFIERS).fill(""))
  const [toast, setToast]           = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [pending, startTransition]  = useTransition()

  const priceNum = Number(price)
  const sharesNum = Number(shares)
  const suggestion = size(priceNum > 0 ? priceNum : 0)
  const costEur = c.eurPerUnit != null && priceNum > 0 && sharesNum > 0 ? priceNum * sharesNum * c.eurPerUnit : null
  // Solo avisa: los límites que bloquean son los de §1.4 (openBlockers).
  const sizeWarning = positionSizeWarning({
    amount:              suggestion.amount,
    totalPortfolioValue: c.totalPortfolioValue,
    priceEur:            c.eurPerUnit != null && priceNum > 0 ? priceNum * c.eurPerUnit : null,
    costEur,
  })

  const input = {
    ticker:     c.ticker,
    openedAt,
    entryPrice: priceNum,
    shares:     sharesNum,
    feesOpen:   Number(fees || 0),
    thesis,
    falsifiers,
  }
  const valid = openInvestPositionInputSchema.safeParse(input).success

  function changePrice(value: string) {
    setPrice(value)
    // Mientras el usuario no toque las acciones, siguen al importe sugerido.
    const p = Number(value)
    if (!sharesTouched && c.eurPerUnit != null && p > 0) setShares(String(size(p).shares))
  }

  function setFalsifier(i: number, value: string) {
    setFalsifiers(list => list.map((f, j) => (j === i ? value : f)))
  }

  function submit() {
    if (!valid || pending) return
    startTransition(async () => {
      const result = await openInvestPosition(input)
      if (result.success) {
        onOpened()
      } else {
        setToast({ message: investErrorMessage(result.error), variant: "error" })
        setTimeout(() => setToast(null), 5000)
      }
    })
  }

  return (
    <Modal
      title={`${c.paper ? O.PAPER_TITLE : O.TITLE} · ${c.ticker}`}
      caption={<>{c.name ? `${c.name} · ` : ""}{O.RUN_CAPTION.replace("{date}", fmtDay(c.runDate))}</>}
      width={600}
      onClose={onClose}
    >
      {toast && (
        <div className="fixed top-4 right-4 z-60">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      {c.paper && (
        <div className="flex items-start gap-3 px-3 py-2.5 rounded-md border border-short/40 bg-short/10">
          <span className="mono text-xs font-semibold tracking-wider uppercase px-2 py-0.5 rounded-sm bg-short text-bg shrink-0">
            {INVEST.PERFORMANCE.PAPER_BADGE}
          </span>
          <span className="text-sm text-short">{O.PAPER_NOTICE}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label={O.DATE}>
          <input type="date" value={openedAt} max={today} onChange={e => setOpenedAt(e.target.value)} className={`${INPUT_CLS} mono`} />
        </Field>
        <Field label={O.PRICE.replace("{currency}", currency)}>
          <input type="number" min="0" step="any" inputMode="decimal" value={price} onChange={e => changePrice(e.target.value)} className={`${INPUT_CLS} mono`} />
        </Field>
        <Field label={O.SHARES}>
          <input
            type="number" min="0" step="any" inputMode="decimal" value={shares}
            onChange={e => { setShares(e.target.value); setTouched(true) }}
            className={`${INPUT_CLS} mono`}
          />
        </Field>
        <Field label={O.FEES}>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={fees} onChange={e => setFees(e.target.value)} className={`${INPUT_CLS} mono`} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg px-3 py-2 text-sm">
        <span className="text-text-mute">
          {c.eurPerUnit != null
            ? O.SUGGESTED.replace("{amount}", eur(suggestion.amount)).replace("{shares}", String(suggestion.shares))
            : O.SUGGESTED_NO_FX.replace("{amount}", eur(suggestion.amount)).replace("{currency}", currency)}
        </span>
        {costEur != null && (
          <span className={cn("mono", sizeWarning && sizeWarning.kind !== "under" ? "text-short" : "text-text")}>
            {O.COST} {eur(costEur)}
          </span>
        )}
        {sizeWarning && (
          <span className="basis-full text-short">
            {O.SIZE_WARNING[sizeWarning.kind]
              .replace("{pct}", fmtPct(sizeWarning.pct))
              .replace("{target}", fmtPct(c.positionPct, { decimals: 0 }))}
          </span>
        )}
      </div>

      <Field label={O.THESIS} hint={O.THESIS_HINT.replace("{min}", String(THESIS_MIN_LENGTH))}>
        <div className="relative">
          <textarea
            value={thesis} onChange={e => setThesis(e.target.value)} rows={5}
            className={`${INPUT_CLS} resize-y`}
          />
          <span className="absolute bottom-2 right-2.5"><Counter n={thesis.trim().length} min={THESIS_MIN_LENGTH} /></span>
        </div>
      </Field>

      <Field
        label={O.FALSIFIERS}
        hint={O.FALSIFIERS_HINT.replace("{count}", String(MIN_FALSIFIERS)).replace("{min}", String(FALSIFIER_MIN_LENGTH))}
      >
        <div className="flex flex-col gap-2">
          {falsifiers.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="mono text-xs text-text-mute w-4 shrink-0">{i + 1}</span>
              <div className="relative flex-1">
                <input value={f} onChange={e => setFalsifier(i, e.target.value)} className={`${INPUT_CLS} pr-14`} />
                <span className="absolute top-1/2 -translate-y-1/2 right-2.5"><Counter n={f.trim().length} min={FALSIFIER_MIN_LENGTH} /></span>
              </div>
              {falsifiers.length > MIN_FALSIFIERS && (
                <button
                  type="button" onClick={() => setFalsifiers(list => list.filter((_, j) => j !== i))}
                  className="text-xs text-text-mute hover:text-loss shrink-0"
                >
                  {O.REMOVE}
                </button>
              )}
            </div>
          ))}
          <button
            type="button" onClick={() => setFalsifiers(list => [...list, ""])}
            className="self-start text-sm text-text-dim hover:text-accent"
          >
            + {O.ADD_FALSIFIER}
          </button>
        </div>
      </Field>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">{O.CANCEL}</button>
        <button
          type="button" onClick={submit} disabled={!valid || pending}
          className="btn-accent inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? <><Spinner />{O.SUBMITTING}</> : c.paper ? O.SUBMIT_PAPER : O.SUBMIT}
        </button>
      </div>
    </Modal>
  )
}
