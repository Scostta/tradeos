"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { saveInvestSettings, startRealTest } from "~/actions/invest"
import { INVEST } from "~/constants/copies/invest"
import type { InvestSettings } from "~/types/invest"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import { investErrorMessage } from "./invest-errors"
import { Spinner } from "./spinner"
import { fmtDay } from "./invest-format"

const S = INVEST.SETTINGS
export const INPUT_CLS =
  "bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"

// Valores por defecto de invest_settings (§2.4) para el primer guardado.
const DEFAULTS = { satellitePct: 0.2, maxPositions: 5, positionPct: 0.04, benchmarkTicker: "IWDA.AS" }

type Props = {
  settings:  InvestSettings | null
  onSaved?:  () => void
  onCancel?: () => void
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactElement }): ReactElement {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-caps">{label}</span>
      {children}
      {hint && <span className="text-sm text-text-mute">{hint}</span>}
    </label>
  )
}

export function SettingsForm({ settings, onSaved, onCancel }: Props): ReactElement {
  const [total, setTotal]         = useState(settings ? String(settings.totalPortfolioValue) : "")
  const [benchmark, setBenchmark] = useState(settings?.benchmarkTicker ?? DEFAULTS.benchmarkTicker)
  const [toast, setToast]         = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [pending, startTransition] = useTransition()

  const fixed = settings ?? DEFAULTS
  const totalNum = Number(total)
  const valid = total.trim() !== "" && totalNum > 0 && benchmark.trim() !== ""

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 4000)
  }

  function save() {
    if (!valid || pending) return
    startTransition(async () => {
      const result = await saveInvestSettings({
        totalPortfolioValue: totalNum,
        benchmarkTicker:     benchmark.trim(),
      })
      if (result.success) {
        showToast(S.SAVED, "success")
        onSaved?.()
      } else {
        showToast(investErrorMessage(result.error), "error")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      <Field label={S.TOTAL} hint={S.TOTAL_HINT}>
        <input
          type="number" min="0" step="100" inputMode="decimal"
          value={total} onChange={e => setTotal(e.target.value)}
          className={`${INPUT_CLS} mono`} placeholder="100000"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={S.BENCHMARK} hint={S.BENCHMARK_HINT}>
          <input
            value={benchmark} onChange={e => setBenchmark(e.target.value.toUpperCase())}
            className={`${INPUT_CLS} mono`} spellCheck={false} autoComplete="off"
          />
        </Field>
        <TestStatus settings={settings} onStarted={onSaved} />
      </div>

      <div className="rounded-md border border-border bg-bg px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="label-caps">{S.FIXED_TITLE}</span>
          <span className="text-xs text-text-mute">{S.FIXED_HINT}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {[
            [S.SATELLITE, `${Math.round(fixed.satellitePct * 100)}%`],
            [S.MAX_POSITIONS, String(fixed.maxPositions)],
            [S.POSITION_SIZE, `${(fixed.positionPct * 100).toFixed(0)}%`],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-sm text-text-mute">{label}</span>
              <span className="mono text-lg text-text">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">{S.CANCEL}</button>
        )}
        <button
          type="button" onClick={save} disabled={!valid || pending}
          className="btn-accent inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? <><Spinner />{S.SAVING}</> : S.SAVE}
        </button>
      </div>
    </div>
  )
}

// §1.6: started_at no se edita. Modo papel → botón "Start real test" (con
// confirmación); después, la primera posición real fija la fecha.
function TestStatus({ settings, onStarted }: { settings: InvestSettings | null; onStarted?: () => void }): ReactElement {
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const paperMode = settings?.paperMode ?? true

  function start() {
    if (!armed) { setArmed(true); return }
    startTransition(async () => {
      const result = await startRealTest()
      if (result.success) onStarted?.()
      else setError(investErrorMessage(result.error))
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-caps">{S.STARTED_AT}</span>
      {paperMode ? (
        <>
          <span className="inline-flex self-start items-center gap-2 mt-1 px-2.5 py-1 rounded-full bg-short/10 text-short text-sm font-medium">
            <span className="size-1.5 rounded-full bg-short" />
            {S.PAPER_MODE}
          </span>
          <span className="text-sm text-text-mute">{S.PAPER_MODE_HINT}</span>
          {settings && (
            <>
              <button
                type="button" onClick={start} disabled={pending}
                className={`btn-ghost self-start inline-flex items-center gap-2 mt-1 ${armed ? "border-accent text-accent" : ""}`}
              >
                {pending ? <><Spinner />{S.STARTING}</> : armed ? S.START_REAL_CONFIRM : S.START_REAL}
              </button>
              {armed && <span className="text-sm text-text-mute">{S.START_REAL_HINT}</span>}
              {error && <span className="text-sm text-loss">{error}</span>}
            </>
          )}
        </>
      ) : settings?.startedAt ? (
        <span className="mono text-base text-text py-2">{S.STARTED_ON.replace("{date}", fmtDay(settings.startedAt))}</span>
      ) : (
        <>
          <span className="inline-flex self-start items-center gap-2 mt-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
            <span className="size-1.5 rounded-full bg-accent" />
            {S.REAL_PENDING}
          </span>
          <span className="text-sm text-text-mute">{S.REAL_PENDING_HINT}</span>
        </>
      )}
    </div>
  )
}
