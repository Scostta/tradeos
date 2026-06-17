"use client"

import { useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import type { ReactElement } from "react"
import { createTrade, updateTrade } from "~/actions/trades"
import { uploadTradeAttachment } from "~/actions/attachments"
import { computeGrossPnl, KNOWN_INSTRUMENTS } from "~/lib/calculations/pnl"
import { formatCurrency } from "~/helpers/format"
import { TRADES } from "~/constants/copies/trades"
import { AttachmentStaging } from "~/components/trades/attachment-staging.client"
import { cn } from "~/utils/cn"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import { PlusIcon } from "~/lib/ui/icons/plus-icon"
import { XIcon } from "~/lib/ui/icons/x-icon"
import type { Account } from "~/types/account"
import type { Playbook } from "~/types/playbook"
import type { Trade } from "~/types/trade"

const SESSIONS = ["RTH", "ETH", "overnight"] as const
const INPUT_CLS = "bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"

type ToastState = { message: string; variant: ToastVariant }

type Props = {
  mode:             "create" | "edit"
  accounts:         Account[]
  playbooks:       Playbook[]
  defaultAccountId?: string | null
  initialTrade?:    Trade
}

// datetime-local (local wall-clock) ⇄ ISO (UTC) — mirrors the parser's convention.
function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function TradeFormModal({ mode, accounts, playbooks, defaultAccountId, initialTrade }: Props): ReactElement {
  const router = useRouter()

  const [isOpen, setIsOpen]   = useState(false)
  const [tab, setTab]               = useState<"details" | "attachments">("details")
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [stopPrice, setStopPrice]   = useState("")
  const [accountId, setAccountId]   = useState("")
  const [instrument, setInstrument] = useState("")
  const [direction, setDirection]   = useState<"long" | "short">("long")
  const [contracts, setContracts]   = useState("")
  const [entryPrice, setEntryPrice] = useState("")
  const [exitPrice, setExitPrice]   = useState("")
  const [entryTime, setEntryTime]   = useState("")
  const [exitTime, setExitTime]     = useState("")
  const [pnl, setPnl]               = useState("")
  const [pnlTouched, setPnlTouched] = useState(false)
  const [commission, setCommission] = useState("")
  const [session, setSession]       = useState("")
  const [playbookId, setPlaybookId] = useState("")
  const [notes, setNotes]           = useState("")
  const [toast, setToast]           = useState<ToastState | null>(null)
  const [isPending, startTransition] = useTransition()

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 4000)
  }

  function openModal() {
    if (mode === "edit" && initialTrade) {
      setAccountId(initialTrade.accountId)
      setInstrument(initialTrade.instrument)
      setDirection(initialTrade.direction)
      setContracts(String(initialTrade.contracts))
      setEntryPrice(String(initialTrade.entryPrice))
      setExitPrice(String(initialTrade.exitPrice))
      setEntryTime(isoToLocalInput(initialTrade.entryTime))
      setExitTime(isoToLocalInput(initialTrade.exitTime))
      setPnl(String(initialTrade.pnl))
      setPnlTouched(true)
      setCommission(String(initialTrade.commission))
      setSession(initialTrade.session ?? "")
      setStopPrice(initialTrade.stopPrice != null ? String(initialTrade.stopPrice) : "")
      setPlaybookId(initialTrade.playbookId ?? "")
      setNotes(initialTrade.notes ?? "")
    } else {
      setAccountId(defaultAccountId ?? (accounts.length === 1 ? accounts[0]!.id : ""))
      setInstrument("")
      setDirection("long")
      setContracts("1")
      setEntryPrice("")
      setExitPrice("")
      setEntryTime("")
      setExitTime("")
      setPnl("")
      setPnlTouched(false)
      setCommission("0")
      setSession("")
      setStopPrice("")
      setPlaybookId("")
      setNotes("")
    }
    setTab("details")
    setPendingFiles([])
    setIsOpen(true)
  }

  function closeModal() {
    setIsOpen(false)
  }

  // Auto-suggest gross P&L from prices until the user types their own value.
  const suggested = computeGrossPnl({
    instrument,
    direction,
    entryPrice: parseFloat(entryPrice),
    exitPrice:  parseFloat(exitPrice),
    contracts:  parseFloat(contracts),
  })
  const pnlValue   = pnlTouched ? pnl : (suggested != null ? String(suggested) : "")
  const showingAuto = !pnlTouched && suggested != null
  const netPnl     = (parseFloat(pnlValue) || 0) - (parseFloat(commission) || 0)

  function handleSave() {
    // Validation lives on the Details tab — switch to it so errors are visible.
    if (!accountId)                       { setTab("details"); return showToast(TRADES.FORM.ERR_ACCOUNT, "error") }
    if (!instrument.trim())               { setTab("details"); return showToast(TRADES.FORM.ERR_INSTRUMENT, "error") }
    if (!contracts || !entryPrice || !exitPrice) { setTab("details"); return showToast(TRADES.FORM.ERR_NUMBERS, "error") }
    if (!entryTime || !exitTime)          { setTab("details"); return showToast(TRADES.FORM.ERR_TIMES, "error") }
    if (new Date(exitTime).getTime() <= new Date(entryTime).getTime())
      { setTab("details"); return showToast(TRADES.FORM.ERR_ORDER, "error") }

    const payload = {
      accountId,
      instrument: instrument.trim(),
      direction,
      contracts:  Number(contracts),
      entryPrice: Number(entryPrice),
      exitPrice:  Number(exitPrice),
      entryTime:  new Date(entryTime).toISOString(),
      exitTime:   new Date(exitTime).toISOString(),
      pnl:        Number(pnlValue) || 0,
      commission: Number(commission) || 0,
      session:    session === "" ? null : session,
      stopPrice:  stopPrice.trim() === "" ? null : Number(stopPrice),
      playbookId: playbookId === "" ? null : playbookId,
      notes:      notes.trim() || null,
    }

    startTransition(async () => {
      const result = mode === "edit" && initialTrade
        ? await updateTrade({ ...payload, id: initialTrade.id })
        : await createTrade(payload)

      if (!result.success) {
        showToast(result.error, "error")
        return
      }

      // Trade saved — now upload any staged attachments against its id.
      if (pendingFiles.length > 0) {
        await Promise.all(pendingFiles.map((file) => {
          const fd = new FormData()
          fd.append("file", file)
          fd.append("tradeId", result.data.id)
          return uploadTradeAttachment(fd)
        }))
      }

      showToast(mode === "edit" ? TRADES.FORM.SUCCESS_EDIT : TRADES.FORM.SUCCESS_CREATE, "success")
      closeModal()
      router.refresh()
    })
  }

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      {mode === "create" ? (
        <button onClick={openModal} className="btn-accent inline-flex items-center gap-1.5">
          <PlusIcon />
          {TRADES.LIST.NEW_TRADE}
        </button>
      ) : (
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 px-3 h-7.5 rounded-sm text-base text-text-dim border border-border hover:border-border-hi transition-colors whitespace-nowrap"
        >
          {TRADES.FORM.EDIT_CTA}
        </button>
      )}

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="card border-border-hi max-w-[95vw] max-h-[90vh] overflow-y-auto p-5 flex flex-col gap-3"
            style={{ width: 600, boxShadow: "0 20px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-text">
                {mode === "edit" ? TRADES.FORM.EDIT_TITLE : TRADES.FORM.CREATE_TITLE}
              </h2>
              <Button variant="icon" onClick={closeModal} className="shrink-0">
                <XIcon />
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-0.5 rounded-sm bg-surface-2 border border-border">
              {(["details", "attachments"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 text-xs py-1.5 rounded-sm transition-colors cursor-pointer",
                    tab === t ? "bg-surface text-text" : "text-text-mute hover:text-text-dim"
                  )}
                >
                  {t === "details"
                    ? TRADES.FORM.TAB_DETAILS
                    : `${TRADES.FORM.TAB_ATTACHMENTS}${pendingFiles.length ? ` · ${pendingFiles.length}` : ""}`}
                </button>
              ))}
            </div>

            {tab === "attachments" ? (
              <AttachmentStaging files={pendingFiles} onChange={setPendingFiles} disabled={isPending} />
            ) : (
            <>
            {/* Account + Instrument */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={TRADES.FORM.ACCOUNT}>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={INPUT_CLS}>
                  <option value="" disabled>{TRADES.FORM.SELECT_ACCOUNT}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={TRADES.FORM.INSTRUMENT}>
                <input
                  type="text"
                  list="instrument-symbols"
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value)}
                  placeholder="NQ"
                  className={INPUT_CLS}
                />
                <datalist id="instrument-symbols">
                  {KNOWN_INSTRUMENTS.map((s) => <option key={s} value={s} />)}
                </datalist>
              </Field>
            </div>

            {/* Direction + Contracts */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={TRADES.FORM.DIRECTION}>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["long", "short"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className={cn(
                        "text-xs py-2 rounded-sm border transition-colors",
                        direction === d
                          ? "border-accent text-text bg-surface-2"
                          : "border-border text-text-mute hover:border-border-hi"
                      )}
                    >
                      {d === "long" ? TRADES.FORM.LONG : TRADES.FORM.SHORT}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={TRADES.FORM.CONTRACTS}>
                <input type="number" min="1" step="1" value={contracts} onChange={(e) => setContracts(e.target.value)} placeholder="1" className={INPUT_CLS} />
              </Field>
            </div>

            {/* Entry + Exit price */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={TRADES.FORM.ENTRY_PRICE}>
                <input type="number" step="0.0001" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0.0000" className={INPUT_CLS} />
              </Field>
              <Field label={TRADES.FORM.EXIT_PRICE}>
                <input type="number" step="0.0001" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="0.0000" className={INPUT_CLS} />
              </Field>
            </div>

            {/* Entry + Exit time */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={TRADES.FORM.ENTRY_TIME}>
                <input type="datetime-local" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className={INPUT_CLS} />
              </Field>
              <Field label={TRADES.FORM.EXIT_TIME}>
                <input type="datetime-local" value={exitTime} onChange={(e) => setExitTime(e.target.value)} className={INPUT_CLS} />
              </Field>
            </div>

            {/* Stop loss + Session */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={TRADES.FORM.STOP_PRICE} hint={TRADES.FORM.STOP_HINT}>
                <input type="number" step="0.0001" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} placeholder="0.0000" className={INPUT_CLS} />
              </Field>
              <Field label={TRADES.FORM.SESSION}>
                <select value={session} onChange={(e) => setSession(e.target.value)} className={INPUT_CLS}>
                  <option value="">{TRADES.FORM.NONE}</option>
                  {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            {/* Gross P&L + Commission */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={TRADES.FORM.GROSS_PNL} hint={showingAuto ? TRADES.FORM.AUTO : undefined}>
                <input
                  type="number"
                  step="0.01"
                  value={pnlValue}
                  onChange={(e) => { setPnlTouched(true); setPnl(e.target.value) }}
                  placeholder="0.00"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label={TRADES.FORM.COMMISSION}>
                <input type="number" min="0" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="0.00" className={INPUT_CLS} />
              </Field>
            </div>

            {/* Net P&L (derived) + Playbook */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <Field label={TRADES.FORM.PLAYBOOK}>
                <select value={playbookId} onChange={(e) => setPlaybookId(e.target.value)} className={INPUT_CLS}>
                  <option value="">{TRADES.FORM.NONE}</option>
                  {playbooks.filter(s => s.active || s.id === playbookId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <div className="flex items-center justify-between px-2.5 py-2 rounded-sm bg-surface-2 border border-border">
                <span className="label-caps">{TRADES.FORM.NET_PNL}</span>
                <span
                  className="mono text-base font-semibold"
                  style={{ color: netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
                >
                  {formatCurrency(netPnl)}
                </span>
              </div>
            </div>

            {/* Notes */}
            <Field label={TRADES.FORM.NOTES}>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={TRADES.FORM.NOTES_PLACEHOLDER}
                className={cn(INPUT_CLS, "resize-vertical")}
              />
            </Field>
            </>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
              <Button variant="ghost" onClick={closeModal} disabled={isPending}>
                {TRADES.FORM.CANCEL}
              </Button>
              <Button variant="accent" onClick={handleSave} disabled={isPending} loading={isPending}>
                {TRADES.FORM.SAVE}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactElement | ReactElement[] }): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="label-caps">{label}</label>
        {hint && <span className="text-xxs text-accent">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
