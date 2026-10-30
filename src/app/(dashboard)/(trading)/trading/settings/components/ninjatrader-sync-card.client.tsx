"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { createApiToken, revokeApiToken } from "~/actions/api-tokens"
import { TRADING_SETTINGS } from "~/constants/copies/trading-settings"
import { APP_URLS } from "~/constants/app-urls"
import { formatDateTime } from "~/helpers/format"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { ApiToken } from "~/types/api-token"

const S = TRADING_SETTINGS.SYNC

const INPUT_CLASS =
  "bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"

const STEPS = [S.STEP_DOWNLOAD, S.STEP_COMPILE, S.STEP_TOKEN, S.STEP_CHECK]

/** Fichero que lee el add-on desde Documents\NinjaTrader 8\tradeos.json. */
function downloadConfig(token: string) {
  const config = { url: `${window.location.origin}${APP_URLS.INGEST_PREFIX}ninjatrader`, token }
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "tradeos.json"
  a.click()
  URL.revokeObjectURL(url)
}

export function NinjaTraderSyncCard({
  tokens,
  timeZone,
}: {
  tokens:   ApiToken[]
  timeZone: string
}): ReactElement {
  const [name, setName]         = useState<string>(S.TOKEN_NAME_DEFAULT)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [toast, setToast]       = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [creating, startCreate] = useTransition()
  const [, startRevoke]         = useTransition()

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 4000)
  }

  function handleCreate() {
    startCreate(async () => {
      const result = await createApiToken({ name })
      if (result.success) {
        setNewToken(result.data.token)
        showToast(S.CREATED_TOAST, "success")
      } else {
        showToast(result.error, "error")
      }
    })
  }

  function handleRevoke(id: string) {
    setRevokingId(id)
    startRevoke(async () => {
      const result = await revokeApiToken({ id })
      setRevokingId(null)
      if (result.success) showToast(S.REVOKED, "success")
      else showToast(result.error, "error")
    })
  }

  async function handleCopy(token: string) {
    try {
      await navigator.clipboard.writeText(token)
      showToast(S.COPIED, "success")
    } catch {
      showToast(TRADING_SETTINGS.ERRORS.DEFAULT, "error")
    }
  }

  return (
    <section className="card p-5 flex flex-col gap-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <h2 className="text-md font-semibold text-text">{S.TITLE}</h2>
        <p className="text-sm text-text-mute">{S.DESCRIPTION}</p>
      </div>

      <ol className="flex flex-col gap-2">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm text-text">
            <span className="mono text-text-mute shrink-0">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div>
        <a href={APP_URLS.ADDON_DOWNLOAD} download className="btn-ghost inline-flex">
          {S.DOWNLOAD_ADDON}
        </a>
      </div>

      {/* Generar token */}
      <div className="flex flex-col gap-1.5 pt-4 border-t border-border">
        <label className="label-caps">{S.TOKEN_NAME}</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className={INPUT_CLASS}
          />
          <Button
            variant="accent"
            onClick={handleCreate}
            disabled={creating || name.trim() === ""}
            loading={creating}
            className="shrink-0"
          >
            {S.GENERATE}
          </Button>
        </div>
      </div>

      {newToken && (
        <div className="flex flex-col gap-2 rounded-sm border border-border-hi bg-surface-2 p-3">
          <div className="label-caps">{S.NEW_TOKEN_TITLE}</div>
          <code className="mono text-sm text-text break-all">{newToken}</code>
          <p className="text-xxs text-text-mute">{S.NEW_TOKEN_HINT}</p>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="ghost" onClick={() => handleCopy(newToken)}>{S.COPY}</Button>
            <Button variant="accent" onClick={() => downloadConfig(newToken)}>{S.DOWNLOAD_CONFIG}</Button>
          </div>
        </div>
      )}

      {/* Tokens activos */}
      <div className="flex flex-col gap-2">
        <div className="label-caps">{S.ACTIVE_TOKENS}</div>
        {tokens.length === 0 ? (
          <p className="text-sm text-text-mute">{S.NO_TOKENS}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border border-border rounded-sm">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm text-text truncate">
                    {t.name} <span className="mono text-text-mute">{t.tokenPrefix}…</span>
                  </span>
                  <span className="text-xxs text-text-mute">
                    {S.LAST_USED}: {t.lastUsedAt ? formatDateTime(t.lastUsedAt, timeZone) : S.NEVER_USED}
                    {" · "}
                    {S.CREATED}: {formatDateTime(t.createdAt, timeZone)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(t.id)}
                  disabled={revokingId === t.id}
                  className="text-xs text-loss border border-loss/40 rounded-sm px-3 py-1.5 hover:bg-loss/10 transition-colors cursor-pointer disabled:opacity-60 shrink-0"
                >
                  {S.REVOKE}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
