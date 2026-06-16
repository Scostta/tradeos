"use client"

import { useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import type { ReactElement, ReactNode } from "react"
import { updateGoals, deleteGoals } from "~/actions/goals"
import { GOALS } from "~/constants/copies/goals"
import { formatCurrency, formatPct } from "~/helpers/format"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import { XIcon } from "~/lib/ui/icons/x-icon"
import type { GoalSet } from "~/types/goals"

const INPUT_CLS = "bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"

function Bar({ pct, color }: { pct: number; color: string }): ReactElement {
  return (
    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, background: color }} />
    </div>
  )
}

function Metric({ label, valueNode, pct, color }: { label: string; valueNode: ReactNode; pct: number; color: string }): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="label-caps">{label}</span>
        <span className="mono text-xs">{valueNode}</span>
      </div>
      <Bar pct={pct} color={color} />
    </div>
  )
}

const numOrNull = (v: string): number | null => (v.trim() !== "" ? parseFloat(v) : null)
const intOrNull = (v: string): number | null => (v.trim() !== "" ? parseInt(v, 10) : null)

export function GoalsCard({ set }: { set: GoalSet }): ReactElement {
  const { scope, goals, progress } = set
  const router = useRouter()
  const [isOpen, setIsOpen]   = useState(false)
  const [pnl, setPnl]         = useState("")
  const [winRate, setWinRate] = useState("")
  const [maxDd, setMaxDd]     = useState("")
  const [minDays, setMinDays] = useState("")
  const [toast, setToast]     = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [isPending, startTransition] = useTransition()

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 4000)
  }

  function openModal() {
    setPnl(goals.monthlyPnlTarget != null ? String(goals.monthlyPnlTarget) : "")
    setWinRate(goals.winRateTarget != null ? String(Math.round(goals.winRateTarget * 100)) : "")
    setMaxDd(goals.maxDrawdownLimit != null ? String(goals.maxDrawdownLimit) : "")
    setMinDays(goals.minTradingDays != null ? String(goals.minTradingDays) : "")
    setIsOpen(true)
  }

  function handleSave() {
    const wr = numOrNull(winRate)
    startTransition(async () => {
      const result = await updateGoals({
        accountId:        scope.accountId,
        monthlyPnlTarget: numOrNull(pnl),
        winRateTarget:    wr != null ? wr / 100 : null,
        maxDrawdownLimit: numOrNull(maxDd),
        minTradingDays:   intOrNull(minDays),
      })
      if (result.success) { showToast(GOALS.EDITOR.SUCCESS, "success"); setIsOpen(false); router.refresh() }
      else showToast(GOALS.EDITOR.ERROR, "error")
    })
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await deleteGoals({ accountId: scope.accountId })
      if (result.success) { showToast(GOALS.EDITOR.REMOVED, "success"); setIsOpen(false); router.refresh() }
      else showToast(GOALS.EDITOR.ERROR, "error")
    })
  }

  const { pnl: p, winRate: w, drawdown: d, tradingDays: td } = progress

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {scope.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: scope.color }} />}
            <span className="text-md font-semibold text-text truncate">{scope.label}</span>
            <span className="mono text-xs text-text-mute shrink-0">{progress.monthLabel}</span>
          </div>
          <button onClick={openModal} className="text-xs text-text-mute hover:text-text-dim transition-colors shrink-0">
            {progress.hasAnyGoal ? GOALS.EDIT : GOALS.SET_CTA}
          </button>
        </div>

        {!progress.hasAnyGoal ? (
          <p className="text-sm text-text-mute italic">{GOALS.EMPTY}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {p && (
              <Metric label={GOALS.PNL}
                valueNode={<><span style={{ color: p.met ? "var(--color-profit)" : "var(--color-text)" }}>{formatCurrency(p.current)}</span><span className="text-text-mute"> / {formatCurrency(p.target, { sign: false })}</span></>}
                pct={p.pct} color={p.met ? "var(--color-profit)" : "var(--color-accent)"} />
            )}
            {w && (
              <Metric label={GOALS.WIN_RATE}
                valueNode={<><span style={{ color: w.met ? "var(--color-profit)" : "var(--color-text)" }}>{formatPct(w.current)}</span><span className="text-text-mute"> / {formatPct(w.target)}</span></>}
                pct={w.pct} color={w.met ? "var(--color-profit)" : "var(--color-accent)"} />
            )}
            {d && (
              <Metric label={GOALS.MAX_DD}
                valueNode={<><span style={{ color: d.breached ? "var(--color-loss)" : "var(--color-text)" }}>{formatCurrency(d.current, { sign: false })}</span><span className="text-text-mute"> / {formatCurrency(d.limit, { sign: false })}</span></>}
                pct={d.pct} color={d.breached ? "var(--color-loss)" : d.pct >= 0.8 ? "#f59e0b" : "var(--color-profit)"} />
            )}
            {td && (
              <Metric label={GOALS.TRADING_DAYS}
                valueNode={<><span style={{ color: td.met ? "var(--color-profit)" : "var(--color-text)" }}>{td.current}</span><span className="text-text-mute"> / {td.target}</span></>}
                pct={td.pct} color={td.met ? "var(--color-profit)" : "var(--color-accent)"} />
            )}
          </div>
        )}
      </div>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
          <div className="card border-border-hi w-full p-6 flex flex-col gap-5" style={{ maxWidth: 440, boxShadow: "0 20px 80px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {scope.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: scope.color }} />}
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-text truncate">{scope.label}</h2>
                  <span className="label-caps mt-0.5 block">{GOALS.EDITOR.CAPTION}</span>
                </div>
              </div>
              <Button variant="icon" onClick={() => setIsOpen(false)} className="shrink-0"><XIcon /></Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="label-caps">{GOALS.EDITOR.PNL}</label>
                <input type="number" min="0" step="0.01" value={pnl} onChange={e => setPnl(e.target.value)} placeholder="—" className={INPUT_CLS} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="label-caps">{GOALS.EDITOR.WIN_RATE}</label>
                <input type="number" min="0" max="100" step="1" value={winRate} onChange={e => setWinRate(e.target.value)} placeholder="—" className={INPUT_CLS} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="label-caps">{GOALS.EDITOR.MAX_DD}</label>
                <input type="number" min="0" step="0.01" value={maxDd} onChange={e => setMaxDd(e.target.value)} placeholder="—" className={INPUT_CLS} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="label-caps">{GOALS.EDITOR.MIN_DAYS}</label>
                <input type="number" min="0" step="1" value={minDays} onChange={e => setMinDays(e.target.value)} placeholder="—" className={INPUT_CLS} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
              {progress.hasAnyGoal ? (
                <button type="button" onClick={handleRemove} disabled={isPending}
                  className="text-xs text-text-mute hover:text-loss transition-colors disabled:opacity-60">
                  {GOALS.EDITOR.REMOVE}
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>{GOALS.EDITOR.CANCEL}</Button>
                <Button variant="accent" onClick={handleSave} disabled={isPending} loading={isPending}>{GOALS.EDITOR.SAVE}</Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
