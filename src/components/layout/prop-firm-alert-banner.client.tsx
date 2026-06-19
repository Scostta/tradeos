"use client"

import { useSyncExternalStore } from "react"
import type { ReactElement } from "react"
import Link from "next/link"
import { PROP_FIRM } from "~/constants/copies/prop-firm"
import type { PropFirmAlertItem } from "~/types/prop-firm"
import { XIcon } from "~/lib/ui/icons/x-icon"

const STORAGE_KEY = "propfirm_alerts_dismissed"
const DISMISS_EVENT = "propfirm-alerts-dismissed"

// Read the dismissed signature from localStorage as an external store, so the
// banner reacts to dismissal without setState-in-effect. Server snapshot is
// null (nothing dismissed) — it reconciles to the real value after hydration.
function subscribe(onChange: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}
function useDismissedSig(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(STORAGE_KEY),
    () => null,
  )
}

const LEVEL_ACCENT: Record<"danger" | "breached", string> = {
  danger:   "#f97316",
  breached: "var(--color-loss)",
}

function money(n: number): string {
  const sign = n < 0 ? "-" : ""
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function chipLabel(a: PropFirmAlertItem): string {
  if (a.alertLevel === "breached") return PROP_FIRM.BANNER.BLOWN
  if (a.roomLeft != null)  return `${PROP_FIRM.ROOM_LEFT} ${money(a.roomLeft)}`
  if (a.dailyLeft != null) return `${money(a.dailyLeft)} ${PROP_FIRM.REMAINING}`
  return PROP_FIRM.ALERT.danger
}

// Stable signature of the current alert set: when accounts or their levels
// change, a prior dismissal no longer matches and the banner reappears.
function signature(alerts: PropFirmAlertItem[]): string {
  return alerts.map((a) => `${a.id}:${a.alertLevel}`).sort().join("|")
}

export function PropFirmAlertBanner({ alerts }: { alerts: PropFirmAlertItem[] }): ReactElement | null {
  const sig = signature(alerts)
  const dismissedSig = useDismissedSig()

  if (alerts.length === 0 || dismissedSig === sig) return null

  const worst: "danger" | "breached" = alerts.some((a) => a.alertLevel === "breached") ? "breached" : "danger"
  const accent = LEVEL_ACCENT[worst]

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, sig)
    window.dispatchEvent(new Event(DISMISS_EVENT))
  }

  return (
    <div
      className="shrink-0 flex items-center gap-3 px-4 py-2 border-b text-sm"
      style={{ borderColor: accent, background: `color-mix(in srgb, ${accent} 12%, var(--color-bg))` }}
    >
      <span className="label-caps shrink-0" style={{ color: accent }}>
        {PROP_FIRM.BANNER.TITLE}
      </span>

      <div className="flex items-center gap-2 overflow-x-auto min-w-0">
        {alerts.map((a) => (
          <Link
            key={a.id}
            href="/accounts"
            className="flex items-center gap-1.5 shrink-0 rounded-sm border border-border bg-surface px-2 py-0.5 hover:border-border-hi transition-colors"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
            <span className="text-text truncate max-w-40">{a.name}</span>
            <span className="mono text-xs" style={{ color: LEVEL_ACCENT[a.alertLevel] }}>
              {chipLabel(a)}
            </span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="ml-auto shrink-0 p-1 text-text-mute hover:text-text transition-colors cursor-pointer"
        aria-label={PROP_FIRM.BANNER.DISMISS}
      >
        <XIcon />
      </button>
    </div>
  )
}
