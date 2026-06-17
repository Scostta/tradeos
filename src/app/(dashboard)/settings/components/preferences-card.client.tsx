"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { updateProfile } from "~/actions/profile"
import { TIMEZONES, CURRENCIES } from "~/constants/timezones"
import { SETTINGS } from "~/constants/copies/settings"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { Profile } from "~/types/profile"

const INPUT_CLASS =
  "bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"

export function PreferencesCard({ profile }: { profile: Profile }): ReactElement {
  const [displayName, setDisplayName] = useState(profile.displayName ?? "")
  const [timezone, setTimezone]       = useState<string>(profile.timezone)
  const [currency, setCurrency]       = useState<string>(profile.defaultCurrency)
  const [toast, setToast]             = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [isPending, startTransition]  = useTransition()

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 4000)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateProfile({
        displayName:     displayName.trim() || null,
        timezone,
        defaultCurrency: currency,
      })
      if (result.success) showToast(SETTINGS.PREFERENCES.SAVED, "success")
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

      <h2 className="text-md font-semibold text-text">{SETTINGS.PREFERENCES.TITLE}</h2>

      <div className="flex flex-col gap-1.5">
        <label className="label-caps">{SETTINGS.PREFERENCES.DISPLAY_NAME}</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={SETTINGS.PREFERENCES.DISPLAY_NAME_PLACEHOLDER}
          maxLength={60}
          className={INPUT_CLASS}
        />
        <p className="text-xxs text-text-mute">{SETTINGS.PREFERENCES.DISPLAY_NAME_HINT}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="label-caps">{SETTINGS.PREFERENCES.TIMEZONE}</label>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={INPUT_CLASS}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="label-caps">{SETTINGS.PREFERENCES.CURRENCY}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={INPUT_CLASS}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xxs text-text-mute -mt-1.5">{SETTINGS.PREFERENCES.TIMEZONE_HINT}</p>

      <div className="flex justify-end pt-1 border-t border-border">
        <Button variant="accent" onClick={handleSave} disabled={isPending} loading={isPending}>
          {SETTINGS.PREFERENCES.SAVE}
        </Button>
      </div>
    </section>
  )
}
