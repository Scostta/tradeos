"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { updateEmail, updatePassword } from "~/actions/profile"
import { SETTINGS } from "~/constants/copies/settings"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"

const INPUT_CLASS =
  "bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"

export function SecurityCard({ email }: { email: string }): ReactElement {
  const [emailValue, setEmailValue] = useState(email)
  const [password, setPassword]     = useState("")
  const [confirm, setConfirm]       = useState("")
  const [toast, setToast]           = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [emailPending, startEmail]  = useTransition()
  const [pwPending, startPw]        = useTransition()

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 4000)
  }

  function handleEmail() {
    startEmail(async () => {
      const result = await updateEmail({ email: emailValue.trim() })
      if (result.success) showToast(SETTINGS.SECURITY.EMAIL_SENT, "success")
      else showToast(result.error, "error")
    })
  }

  function handlePassword() {
    if (password !== confirm) {
      showToast(SETTINGS.SECURITY.PASSWORD_MISMATCH, "error")
      return
    }
    startPw(async () => {
      const result = await updatePassword({ password })
      if (result.success) {
        showToast(SETTINGS.SECURITY.PASSWORD_SAVED, "success")
        setPassword("")
        setConfirm("")
      } else {
        showToast(result.error, "error")
      }
    })
  }

  const emailUnchanged = emailValue.trim() === email || emailValue.trim() === ""
  const pwIncomplete   = password.length < 8 || confirm.length < 8

  return (
    <section className="card p-5 flex flex-col gap-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      <h2 className="text-md font-semibold text-text">{SETTINGS.SECURITY.TITLE}</h2>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label className="label-caps">{SETTINGS.SECURITY.EMAIL}</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            className={INPUT_CLASS}
          />
          <Button variant="ghost" onClick={handleEmail} disabled={emailPending || emailUnchanged} loading={emailPending} className="shrink-0">
            {SETTINGS.SECURITY.EMAIL_SAVE}
          </Button>
        </div>
        <p className="text-xxs text-text-mute">{SETTINGS.SECURITY.EMAIL_HINT}</p>
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
          <div className="flex flex-col gap-1.5">
            <label className="label-caps">{SETTINGS.SECURITY.PASSWORD}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={SETTINGS.SECURITY.PASSWORD_PLACEHOLDER}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label-caps">{SETTINGS.SECURITY.PASSWORD_CONFIRM}</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={SETTINGS.SECURITY.PASSWORD_PLACEHOLDER}
              className={INPUT_CLASS}
            />
          </div>
        </div>
        <div className="flex justify-end mt-1">
          <Button variant="accent" onClick={handlePassword} disabled={pwPending || pwIncomplete} loading={pwPending}>
            {SETTINGS.SECURITY.PASSWORD_SAVE}
          </Button>
        </div>
      </div>
    </section>
  )
}
