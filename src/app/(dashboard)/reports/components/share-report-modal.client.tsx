"use client"

import { useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import type { ReactElement } from "react"
import { createReportShare, revokeReportShare } from "~/actions/report-share"
import { SHARE } from "~/constants/copies/share"
import { APP_URLS } from "~/constants/app-urls"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import { XIcon } from "~/lib/ui/icons/x-icon"
import type { TradesRange } from "~/types/trade-filters"
import type { ReportShareSummary } from "~/types/report-share"

type Props = {
  accountId: string | null
  range:     TradesRange
  shares:    ReportShareSummary[]
}

const shareUrl = (token: string): string =>
  typeof window !== "undefined" ? `${window.location.origin}${APP_URLS.SHARE_PREFIX}${token}` : `${APP_URLS.SHARE_PREFIX}${token}`

export function ShareReportModal({ accountId, range, shares }: Props): ReactElement {
  const router = useRouter()
  const [isOpen, setIsOpen]   = useState(false)
  const [error, setError]     = useState(false)
  const [copiedId, setCopied] = useState<string | null>(null)
  const [isPending, start]    = useTransition()

  function create() {
    setError(false)
    start(async () => {
      const result = await createReportShare({ accountId, range })
      if (result.success) router.refresh()
      else { setError(true); setTimeout(() => setError(false), 4000) }
    })
  }

  function revoke(id: string) {
    start(async () => {
      await revokeReportShare({ id })
      router.refresh()
    })
  }

  function copy(id: string, token: string) {
    void navigator.clipboard.writeText(shareUrl(token))
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant="error" message={SHARE.MODAL.ERROR} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-sm text-base text-text-dim border border-border hover:border-border-hi transition-colors whitespace-nowrap cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
        </svg>
        {SHARE.BUTTON}
      </button>

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="card border-border-hi w-full flex flex-col gap-4 p-6"
            style={{ maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text">{SHARE.MODAL.TITLE}</h2>
                <p className="text-sm text-text-mute mt-1">{SHARE.MODAL.DESC}</p>
              </div>
              <Button variant="icon" onClick={() => setIsOpen(false)} className="shrink-0">
                <XIcon />
              </Button>
            </div>

            <Button variant="accent" onClick={create} disabled={isPending} loading={isPending}>
              {isPending ? SHARE.MODAL.CREATING : SHARE.MODAL.CREATE}
            </Button>

            <div className="flex flex-col gap-2">
              <div className="label-caps">{SHARE.MODAL.EXISTING}</div>
              {shares.length === 0 ? (
                <div className="text-sm text-text-mute py-2">{SHARE.MODAL.NONE}</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {shares.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 bg-surface-2 border border-border rounded-sm px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text truncate">{s.title}</div>
                        <div className="mono text-xxs text-text-mute truncate">{shareUrl(s.token)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(s.id, s.token)}
                        className="text-xs text-text-dim hover:text-text transition-colors shrink-0 cursor-pointer"
                      >
                        {copiedId === s.id ? SHARE.MODAL.COPIED : SHARE.MODAL.COPY}
                      </button>
                      <a
                        href={shareUrl(s.token)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-text-dim hover:text-text transition-colors shrink-0"
                      >
                        {SHARE.MODAL.OPEN}
                      </a>
                      <button
                        type="button"
                        onClick={() => revoke(s.id)}
                        disabled={isPending}
                        className="text-xs text-text-mute hover:text-loss transition-colors shrink-0 disabled:opacity-60 cursor-pointer"
                      >
                        {SHARE.MODAL.REVOKE}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
