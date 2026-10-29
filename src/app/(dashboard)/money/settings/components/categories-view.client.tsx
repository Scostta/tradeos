"use client"

import { useRef, useState, useTransition } from "react"
import type { ReactElement } from "react"
import { createFinanceCategory, updateFinanceCategory } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { CategoryKind, FinanceCategory } from "~/types/finance"
import { cn } from "~/utils/cn"
import { moneyErrorMessage } from "../../components/money-errors"

const S = MONEY.SETTINGS
const KIND_ORDER: CategoryKind[] = ["expense", "income", "savings", "transfer"]
const KINDS = Object.keys(S.KINDS) as CategoryKind[]

type Fields = { name: string; kind: CategoryKind; isFixed: boolean; color: string; archived: boolean }

// §5.6 pestaña Categories: alta arriba y una fila editable por categoría,
// agrupadas por tipo. Cada cambio se guarda al momento (nombre, al salir del campo).
export function CategoriesView({ categories, counts }: {
  categories: FinanceCategory[]
  counts:     Record<string, number>          // movimientos por categoría
}): ReactElement {
  const [draft, setDraft] = useState({ name: "", kind: "expense" as CategoryKind, isFixed: false, color: "#94a3b8" })
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [pending, startTransition] = useTransition()
  const colorTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  function showToast(message: string, variant: ToastVariant = "success") {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 3000)
  }

  function add() {
    if (!draft.name.trim() || pending) return
    startTransition(async () => {
      const res = await createFinanceCategory(draft)
      if (res.success) {
        setDraft(d => ({ ...d, name: "" }))
        showToast(S.CATEGORY_ADDED)
      } else showToast(moneyErrorMessage(res.error), "error")
    })
  }

  function save(c: FinanceCategory, patch: Partial<Fields>) {
    const next: Fields = { name: c.name, kind: c.kind, isFixed: c.isFixed, color: c.color, archived: c.archived, ...patch }
    if (!next.name.trim()) return
    startTransition(async () => {
      const res = await updateFinanceCategory({ categoryId: c.id, ...next })
      if (res.success) showToast(S.CATEGORY_SAVED)
      else showToast(moneyErrorMessage(res.error), "error")
    })
  }

  // El selector nativo emite un cambio por cada paso al arrastrar: se guarda el último.
  function saveColor(c: FinanceCategory, color: string) {
    clearTimeout(colorTimers.current.get(c.id))
    colorTimers.current.set(c.id, setTimeout(() => save(c, { color }), 600))
  }

  const groups = [
    ...KIND_ORDER.map(kind => ({ title: MONEY.TRANSACTIONS.KIND_GROUPS[kind], rows: categories.filter(c => c.kind === kind && !c.archived) })),
    { title: S.ARCHIVED, rows: categories.filter(c => c.archived) },
  ].filter(g => g.rows.length > 0)

  return (
    <div className="flex flex-col gap-3 max-w-4xl">
      {toast && <div className="fixed top-4 right-4 z-50"><Toast variant={toast.variant} message={toast.message} /></div>}

      <form onSubmit={e => { e.preventDefault(); add() }} className="card px-4 py-3 flex flex-col gap-3">
        <span className="label-caps">{S.NEW_CATEGORY}</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color" value={draft.color} onChange={e => setDraft(d => ({ ...d, color: e.target.value }))}
            aria-label={S.COLOR} className="size-9 shrink-0 rounded-sm border border-border bg-transparent cursor-pointer"
          />
          <input
            value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} maxLength={40}
            placeholder={S.NAME_PLACEHOLDER} aria-label={S.NAME} className={cn(INPUT_CLS, "flex-1 min-w-40 basis-0")}
          />
          <div className="w-32 shrink-0">
            <select
              value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value as CategoryKind }))}
              aria-label={S.KIND} className={INPUT_CLS}
            >
              {KINDS.map(k => <option key={k} value={k}>{S.KINDS[k]}</option>)}
            </select>
          </div>
          {draft.kind === "expense" && (
            <label className="flex items-center gap-1.5 text-sm text-text-dim cursor-pointer">
              <input type="checkbox" checked={draft.isFixed} onChange={e => setDraft(d => ({ ...d, isFixed: e.target.checked }))} className="accent-accent" />
              {S.FIXED}
            </label>
          )}
          <button type="submit" disabled={pending || !draft.name.trim()} className="btn-accent disabled:opacity-60">{S.ADD}</button>
        </div>
        <p className="text-xs text-text-mute">{S.CATEGORIES_HINT}</p>
      </form>

      {groups.map(g => (
        <div key={g.title} className="card p-0">
          <div className="px-4 py-2.5 border-b border-border"><span className="label-caps">{g.title}</span></div>
          {g.rows.map(c => (
            <div key={c.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border last:border-0", c.archived && "opacity-60")}>
              <input
                type="color" defaultValue={c.color} onChange={e => saveColor(c, e.target.value)}
                aria-label={S.COLOR} className="size-8 shrink-0 rounded-sm border border-border bg-transparent cursor-pointer"
              />
              <input
                key={c.name} defaultValue={c.name} maxLength={40} aria-label={S.NAME}
                onBlur={e => e.target.value.trim() !== c.name && save(c, { name: e.target.value.trim() })}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }}
                className={cn(INPUT_CLS, "flex-1 min-w-36 basis-0")}
              />
              <span className="mono text-xs text-text-mute w-14 text-right">{S.COUNT.replace("{n}", String(counts[c.id] ?? 0))}</span>
              <div className="w-28 shrink-0">
                <select
                  value={c.kind} disabled={pending} onChange={e => save(c, { kind: e.target.value as CategoryKind })}
                  aria-label={S.KIND} className={INPUT_CLS}
                >
                  {KINDS.map(k => <option key={k} value={k}>{S.KINDS[k]}</option>)}
                </select>
              </div>
              <label className={cn("flex items-center gap-1.5 text-sm text-text-dim w-16", c.kind === "expense" ? "cursor-pointer" : "invisible")}>
                <input type="checkbox" checked={c.isFixed} disabled={pending} onChange={e => save(c, { isFixed: e.target.checked })} className="accent-accent" />
                {S.FIXED}
              </label>
              <button
                type="button" disabled={pending} onClick={() => save(c, { archived: !c.archived })}
                className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-60"
              >
                {c.archived ? S.RESTORE : S.ARCHIVE}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
