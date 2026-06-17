"use client"

import { useState, useTransition } from "react"
import { createPortal } from "react-dom"
import type { ReactElement } from "react"
import { deleteAccount } from "~/actions/profile"
import { signOut } from "~/actions/auth"
import { SETTINGS } from "~/constants/copies/settings"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import { XIcon } from "~/lib/ui/icons/x-icon"

const INPUT_CLASS =
  "bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"

export function DangerZoneCard({ email }: { email: string }): ReactElement {
  const [isOpen, setIsOpen]          = useState(false)
  const [confirm, setConfirm]        = useState("")
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function close() {
    setIsOpen(false)
    setConfirm("")
    setError(null)
  }

  function handleDelete() {
    if (confirm.trim().toLowerCase() !== email.toLowerCase()) {
      setError(SETTINGS.DANGER.MISMATCH)
      return
    }
    startTransition(async () => {
      const result = await deleteAccount({ confirmEmail: confirm.trim() })
      if (result.success) {
        await signOut() // clears session and redirects to /login
      } else {
        setError(result.error === "EMAIL_MISMATCH" ? SETTINGS.DANGER.MISMATCH : SETTINGS.ERRORS.DEFAULT)
      }
    })
  }

  return (
    <section className="card p-5 flex flex-col gap-4 border-loss/30">
      <h2 className="text-md font-semibold text-loss">{SETTINGS.DANGER.TITLE}</h2>
      <p className="text-sm text-text-mute">{SETTINGS.DANGER.DESCRIPTION}</p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-xs text-loss border border-loss/40 rounded-sm px-3 py-2 hover:bg-loss/10 transition-colors cursor-pointer"
        >
          {SETTINGS.DANGER.DELETE_CTA}
        </button>
      </div>

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
          onClick={close}
        >
          <div
            className="card border-loss/40 max-w-[90vw] p-6 flex flex-col gap-4"
            style={{ width: 440, boxShadow: "0 20px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-loss">{SETTINGS.DANGER.MODAL_TITLE}</h3>
              <Button variant="icon" onClick={close} className="shrink-0">
                <XIcon />
              </Button>
            </div>

            <p className="text-sm text-text-mute">{SETTINGS.DANGER.MODAL_BODY}</p>

            <div className="flex flex-col gap-1.5">
              <label className="label-caps">{SETTINGS.DANGER.CONFIRM_LABEL}</label>
              <input
                type="email"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(null) }}
                placeholder={email}
                autoFocus
                className={INPUT_CLASS}
              />
              {error && <Toast variant="error" message={error} />}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
              <Button variant="ghost" onClick={close} disabled={isPending}>
                {SETTINGS.DANGER.CANCEL}
              </Button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs text-bg bg-loss rounded-sm px-3 py-2 hover:bg-loss/90 transition-colors cursor-pointer disabled:opacity-60"
              >
                {SETTINGS.DANGER.CONFIRM_CTA}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}
