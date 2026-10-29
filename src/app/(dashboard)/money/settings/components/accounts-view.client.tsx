"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { createFinanceAccount, deleteFinanceAccount, setDefaultFinanceAccount, updateFinanceAccount } from "~/actions/finance"
import type { FinanceActionError } from "~/actions/finance"
import type { ResultType } from "~/helpers/result"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { FinanceAccount, FinanceAccountKind } from "~/types/finance"
import { cn } from "~/utils/cn"
import { moneyErrorMessage } from "../../components/money-errors"

const S = MONEY.SETTINGS
const BANK_KINDS: FinanceAccountKind[] = ["checking", "savings", "broker"]

type Fields = { accountName: string; accountKind: FinanceAccountKind; ibanLast4: string | null; active: boolean }

const last4 = (s: string) => (/^\d{4}$/.test(s.trim()) ? s.trim() : null)

// §5.6 pestaña Accounts: alta arriba y una fila editable por cuenta (se guarda
// al salir del campo). Por defecto = la que preselecciona el import. Borrar
// solo si está vacía; con movimientos, archivar.
export function AccountsView({ accounts, counts, defaultAccount }: {
  accounts:       FinanceAccount[]
  counts:         Record<string, number>       // movimientos por cuenta
  defaultAccount: string | null
}): ReactElement {
  const [draft, setDraft] = useState({ name: "", kind: "savings" as FinanceAccountKind, last4: "" })
  const [confirming, setConfirming] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [pending, startTransition] = useTransition()

  function showToast(message: string, variant: ToastVariant = "success") {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 3000)
  }

  function run(action: () => Promise<ResultType<unknown, FinanceActionError>>, ok: string, after?: () => void) {
    startTransition(async () => {
      const res = await action()
      if (res.success) { after?.(); showToast(ok) }
      else showToast(moneyErrorMessage(res.error), "error")
    })
  }

  function add() {
    if (!draft.name.trim() || pending) return
    run(
      () => createFinanceAccount({ accountName: draft.name, accountKind: draft.kind, ibanLast4: last4(draft.last4) }),
      S.ACCOUNT_ADDED,
      () => setDraft(d => ({ ...d, name: "", last4: "" })),
    )
  }

  function save(a: FinanceAccount, patch: Partial<Fields>) {
    const next: Fields = { accountName: a.name, accountKind: a.kind, ibanLast4: a.ibanLast4, active: a.active, ...patch }
    if (!next.accountName.trim()) return
    run(() => updateFinanceAccount({ accountId: a.id, ...next }), S.ACCOUNT_SAVED)
  }

  return (
    <div className="flex flex-col gap-3">
      {toast && <div className="fixed top-4 right-4 z-50"><Toast variant={toast.variant} message={toast.message} /></div>}

      <form onSubmit={e => { e.preventDefault(); add() }} className="card px-4 py-3 flex flex-col gap-3">
        <span className="label-caps">{S.NEW_ACCOUNT}</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} maxLength={60}
            placeholder={S.ACCOUNT_NAME_PLACEHOLDER} aria-label={S.NAME} className={cn(INPUT_CLS, "flex-1 min-w-40 basis-0")}
          />
          <div className="w-32 shrink-0">
            <select value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value as FinanceAccountKind }))} aria-label={S.KIND} className={INPUT_CLS}>
              {BANK_KINDS.map(k => <option key={k} value={k}>{MONEY.ACCOUNT_KINDS[k]}</option>)}
            </select>
          </div>
          <div className="w-28 shrink-0">
            <input
              value={draft.last4} onChange={e => setDraft(d => ({ ...d, last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
              inputMode="numeric" placeholder={S.IBAN_LAST4} aria-label={S.IBAN_LAST4} className={cn(INPUT_CLS, "mono")}
            />
          </div>
          <button type="submit" disabled={pending || !draft.name.trim()} className="btn-accent disabled:opacity-60">{S.ADD}</button>
        </div>
        <p className="text-xs text-text-mute">{S.ACCOUNTS_HINT}</p>
      </form>

      <div className="card p-0">
        {accounts.map(a => {
          const isCash = a.kind === "cash"
          const isDefault = a.id === defaultAccount
          const count = counts[a.id] ?? 0
          return (
            <div key={a.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border last:border-0", !a.active && "opacity-60")}>
              <input
                key={a.name} defaultValue={a.name} maxLength={60} aria-label={S.NAME}
                onBlur={e => e.target.value.trim() !== a.name && save(a, { accountName: e.target.value.trim() })}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }}
                className={cn(INPUT_CLS, "flex-1 min-w-36 basis-0")}
              />
              <span className="mono text-xs text-text-mute w-16 text-right">{S.COUNT.replace("{n}", String(count))}</span>
              <div className="w-28 shrink-0">
                {isCash ? (
                  <div className={cn(INPUT_CLS, "text-text-mute")}>{MONEY.ACCOUNT_KINDS.cash}</div>
                ) : (
                  <select value={a.kind} disabled={pending} onChange={e => save(a, { accountKind: e.target.value as FinanceAccountKind })} aria-label={S.KIND} className={INPUT_CLS}>
                    {BANK_KINDS.map(k => <option key={k} value={k}>{MONEY.ACCOUNT_KINDS[k]}</option>)}
                  </select>
                )}
              </div>
              <div className="w-24 shrink-0">
                {!isCash && (
                  <input
                    key={a.ibanLast4 ?? ""} defaultValue={a.ibanLast4 ?? ""} inputMode="numeric" maxLength={4}
                    placeholder="••••" aria-label={S.IBAN_LAST4} className={cn(INPUT_CLS, "mono")}
                    onBlur={e => last4(e.target.value) !== a.ibanLast4 && save(a, { ibanLast4: last4(e.target.value) })}
                    onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }}
                  />
                )}
              </div>
              <div className="w-28 shrink-0 text-center">
                {isDefault ? (
                  <span className="mono text-xs font-semibold uppercase px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent">{S.DEFAULT}</span>
                ) : !isCash && a.active && (
                  <button type="button" disabled={pending} onClick={() => run(() => setDefaultFinanceAccount({ accountId: a.id }), S.ACCOUNT_SAVED)} className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-60">
                    {S.MAKE_DEFAULT}
                  </button>
                )}
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                {confirming === a.id ? (
                  <>
                    <span className="text-xs text-text-dim">{S.CONFIRM_DELETE}</span>
                    <button
                      type="button" disabled={pending}
                      onClick={() => run(() => deleteFinanceAccount({ accountId: a.id }), S.ACCOUNT_DELETED, () => setConfirming(null))}
                      className="btn-ghost px-2.5 py-1 text-xs text-loss border-loss/40 disabled:opacity-60"
                    >
                      {S.YES}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className="btn-ghost px-2.5 py-1 text-xs">{S.NO}</button>
                  </>
                ) : (
                  <>
                    {!isCash && !isDefault && (
                      <button type="button" disabled={pending} onClick={() => save(a, { active: !a.active })} className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-60">
                        {a.active ? S.ARCHIVE : S.RESTORE}
                      </button>
                    )}
                    {!isCash && !isDefault && count === 0 && (
                      <button type="button" onClick={() => setConfirming(a.id)} className="btn-ghost px-2.5 py-1 text-xs">{S.DELETE}</button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
