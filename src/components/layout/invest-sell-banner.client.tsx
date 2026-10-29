"use client"

import { useSyncExternalStore } from "react"
import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import { XIcon } from "~/lib/ui/icons/x-icon"
import type { InvestSellAlert } from "~/services/queries/invest"

const STORAGE_KEY = "invest_sell_alerts_dismissed"
const DISMISS_EVENT = "invest-sell-alerts-dismissed"
const B = INVEST.SELL_BANNER

// Lo ocultado se lee de localStorage como store externo (sin setState en
// efectos); en el servidor no hay nada ocultado.
function subscribe(onChange: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}
function useDismissedSig(): string | null {
  return useSyncExternalStore(subscribe, () => window.localStorage.getItem(STORAGE_KEY), () => null)
}

// Firma: posición + run. Un run nuevo o otra posición en venta la cambian y
// el aviso vuelve aunque se hubiera ocultado.
function signature(alerts: InvestSellAlert[]): string {
  return alerts.map(a => `${a.positionId}:${a.runDate}`).sort().join("|")
}

// INVEST_SPEC §4.9: aviso de venta en toda la app. Solo avisa: la salida la
// hace el usuario desde la posición.
export function InvestSellBanner({ alerts }: { alerts: InvestSellAlert[] }): ReactElement | null {
  const sig = signature(alerts)
  const dismissedSig = useDismissedSig()
  if (alerts.length === 0 || dismissedSig === sig) return null

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, sig)
    window.dispatchEvent(new Event(DISMISS_EVENT))
  }

  const accent = "var(--color-loss)"
  return (
    <div
      className="shrink-0 flex items-center gap-3 px-4 py-2 border-b text-sm"
      style={{ borderColor: accent, background: `color-mix(in srgb, ${accent} 12%, var(--color-bg))` }}
    >
      <span className="label-caps shrink-0" style={{ color: accent }}>{B.TITLE}</span>
      <span className="hidden md:inline text-text-dim shrink-0">{B.BODY}</span>
      <div className="flex items-center gap-2 overflow-x-auto min-w-0">
        {alerts.map(a => (
          <Link
            key={a.positionId}
            href={`${APP_URLS.INVEST_POSITIONS}/${a.positionId}`}
            className="flex items-center gap-1.5 shrink-0 rounded-sm border border-border bg-surface px-2 py-0.5 hover:border-border-hi transition-colors"
          >
            <span className="mono font-semibold text-text">{a.ticker}</span>
            {a.paper && <span className="text-xs text-text-mute">{B.PAPER}</span>}
            <span className="mono text-xs" style={{ color: accent }}>{B.CHIP.replace("{date}", a.runDate)}</span>
          </Link>
        ))}
      </div>
      <button
        type="button" onClick={dismiss} aria-label={B.DISMISS}
        className="ml-auto shrink-0 p-1 text-text-mute hover:text-text transition-colors cursor-pointer"
      >
        <XIcon />
      </button>
    </div>
  )
}
