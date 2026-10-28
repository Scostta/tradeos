"use client"

import { useState, useTransition } from "react"
import type { ReactElement, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { setupMoney } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"
import { Spinner } from "~/lib/ui/spinner"
import { Toast } from "~/lib/ui/toast"
import type { FinanceAccountKind } from "~/types/finance"
import { moneyErrorMessage } from "./money-errors"

const S = MONEY.SETUP
const KINDS: Exclude<FinanceAccountKind, "cash">[] = ["checking", "savings", "broker"]

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): ReactElement {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-caps">{label}</span>
      {children}
      {hint && <span className="text-sm text-text-mute">{hint}</span>}
    </label>
  )
}

// §5.1: sin finance_settings, alta de Money (cuenta principal + Cash + seed de
// categorías). Hasta entonces no se puede hacer nada más en el módulo.
export function MoneyOnboarding(): ReactElement {
  const router = useRouter()
  const [name, setName] = useState("imagin")
  const [kind, setKind] = useState<Exclude<FinanceAccountKind, "cash">>("checking")
  const [last4, setLast4] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const valid = name.trim().length > 0 && (last4 === "" || /^\d{4}$/.test(last4))

  function submit() {
    if (!valid || pending) return
    startTransition(async () => {
      const result = await setupMoney({ accountName: name.trim(), accountKind: kind, ibanLast4: last4 || null })
      if (result.success) {
        router.refresh()
      } else {
        setError(moneyErrorMessage(result.error))
        setTimeout(() => setError(null), 5000)
      }
    })
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto page-pad">
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant="error" message={error} />
        </div>
      )}
      <div className="card p-6 flex flex-col gap-5 mx-auto" style={{ maxWidth: 560 }}>
        <div>
          <h2 className="text-lg font-semibold text-text">{S.TITLE}</h2>
          <p className="text-md text-text-dim mt-1">{S.BODY}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={S.ACCOUNT_NAME} hint={S.ACCOUNT_HINT}>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={60} className={INPUT_CLS} />
          </Field>
          <Field label={S.ACCOUNT_KIND}>
            <select value={kind} onChange={e => setKind(e.target.value as typeof kind)} className={INPUT_CLS}>
              {KINDS.map(k => <option key={k} value={k}>{MONEY.ACCOUNT_KINDS[k]}</option>)}
            </select>
          </Field>
        </div>

        <Field label={S.IBAN_LAST4} hint={S.IBAN_HINT}>
          <input
            value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric" placeholder="4471" className={`${INPUT_CLS} mono`} style={{ maxWidth: 120 }}
          />
        </Field>

        <div className="flex justify-end">
          <button
            type="button" onClick={submit} disabled={!valid || pending}
            className="btn-accent inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? <><Spinner />{S.SUBMITTING}</> : S.SUBMIT}
          </button>
        </div>
      </div>
    </div>
  )
}
