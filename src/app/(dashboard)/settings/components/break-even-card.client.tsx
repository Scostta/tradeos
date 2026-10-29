"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { updateBeThreshold } from "~/actions/profile"
import { SETTINGS } from "~/constants/copies/settings"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"

const INPUT_CLASS =
  "bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi mono"

// Umbral de break-even de Trading (profiles.be_threshold_points).
export function BreakEvenCard({ points }: { points: number }): ReactElement {
  const [value, setValue]            = useState(String(points))
  const [toast, setToast]            = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [isPending, startTransition] = useTransition()

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 4000)
  }

  function handleSave() {
    const n = Number(value.replace(",", "."))
    if (value.trim() === "" || !Number.isFinite(n) || n < 0 || n > 100) {
      showToast(SETTINGS.BREAK_EVEN.INVALID, "error")
      return
    }
    startTransition(async () => {
      const result = await updateBeThreshold({ points: n })
      if (result.success) showToast(SETTINGS.BREAK_EVEN.SAVED, "success")
      else showToast(result.error, "error")
    })
  }

  return (
    <section className="card p-5 flex flex-col gap-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-md font-semibold text-text">{SETTINGS.BREAK_EVEN.TITLE}</h2>
        <p className="text-sm text-text-dim">{SETTINGS.BREAK_EVEN.DESCRIPTION}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label-caps" htmlFor="be-threshold">{SETTINGS.BREAK_EVEN.THRESHOLD}</label>
        <div style={{ width: 140 }}>
          <input
            id="be-threshold" type="text" inputMode="decimal" value={value}
            onChange={(e) => setValue(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <p className="text-xxs text-text-mute">{SETTINGS.BREAK_EVEN.HINT}</p>
      </div>

      <div className="flex justify-end pt-1 border-t border-border">
        <Button variant="accent" onClick={handleSave} disabled={isPending} loading={isPending}>
          {SETTINGS.BREAK_EVEN.SAVE}
        </Button>
      </div>
    </section>
  )
}
