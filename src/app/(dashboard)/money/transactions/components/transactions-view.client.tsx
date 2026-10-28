"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import type { ReactElement } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { APP_URLS } from "~/constants/app-urls"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { CategorizeResult, FinanceAccount, FinanceCategory, FinanceRule, FinanceTransaction } from "~/types/finance"
import { cn } from "~/utils/cn"
import { CategoryPill } from "../../components/category-pill"
import { displayName, fmtDay, fmtEur } from "../../components/money-format"
import { SplitModal } from "./split-modal.client"
import { TransactionPanel } from "./transaction-panel.client"

const T = MONEY.TRANSACTIONS
const PAGE_SIZE = 50
const ALL = "all"

type Props = {
  transactions:  FinanceTransaction[]
  categories:    FinanceCategory[]
  rules:         FinanceRule[]
  accounts:      FinanceAccount[]
  months:        { month: string; count: number }[]
  month:         string               // YYYY-MM o "all"
  queue:         boolean              // modo cola: solo sin categorizar
  uncategorized: number
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
}

function dayLabel(iso: string): string {
  const weekday = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
  return `${weekday} · ${fmtDay(iso)}`
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

// §5.2 (artboard 02): tabla por días, filtros y panel lateral. En modo cola,
// ↑↓ mueven la selección, Enter abre la categoría, Enter guarda y pasa al
// siguiente, Esc vuelve a la lista.
export function TransactionsView(props: Props): ReactElement {
  const { transactions, categories, rules, accounts, months, month, queue, uncategorized } = props
  const router = useRouter()
  const selectRef = useRef<HTMLSelectElement>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(queue ? transactions[0]?.id ?? null : null)
  const [splitFor, setSplitFor] = useState<FinanceTransaction | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)

  const categoriesById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const accountsById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  // Las partes de un split van debajo de su padre.
  const { top, partsOf } = useMemo(() => {
    const partsOf = new Map<string, FinanceTransaction[]>()
    for (const t of transactions) {
      if (t.parentId) partsOf.set(t.parentId, [...(partsOf.get(t.parentId) ?? []), t])
    }
    return { top: transactions.filter(t => !t.parentId), partsOf }
  }, [transactions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return top.filter(t => {
      const parts = partsOf.get(t.id) ?? []
      if (categoryFilter && t.categoryId !== categoryFilter && !parts.some(p => p.categoryId === categoryFilter)) return false
      if (!q) return true
      return [t.conceptRaw, t.counterparty ?? "", t.notes ?? "", Math.abs(t.amount).toFixed(2)].some(s => s.toLowerCase().includes(q))
    })
  }, [top, partsOf, search, categoryFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const flat = pageRows.flatMap(t => [t, ...(partsOf.get(t.id) ?? [])])

  // Si lo seleccionado desaparece (categorizado en la cola), el que ocupa su sitio.
  const [fallbackIndex, setFallbackIndex] = useState(0)
  const selectedIndex = flat.findIndex(t => t.id === selectedId)
  const selected = selectedIndex !== -1 ? flat[selectedIndex]! : queue ? flat[Math.min(fallbackIndex, flat.length - 1)] ?? null : null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target) || splitFor) return
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return
      e.preventDefault()
      if (e.key === "Enter") { selectRef.current?.focus(); return }
      const i = selected ? flat.findIndex(t => t.id === selected.id) : -1
      const j = Math.max(0, Math.min(flat.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))
      if (flat[j]) { setSelectedId(flat[j]!.id); setFallbackIndex(j) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flat, selected, splitFor])

  useEffect(() => {
    if (selected) document.getElementById(`tx-${selected.id}`)?.scrollIntoView({ block: "nearest" })
  }, [selected])

  function showToast(message: string, variant: ToastVariant = "success") {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 3000)
  }

  function onSaved(result: CategorizeResult) {
    showToast(result.applied > 0 ? T.SAVED_RULE.replace("{n}", String(result.applied)) : T.SAVED)
    if (queue && selected) {
      // Pasa al siguiente; al refrescar, lo guardado sale de la cola.
      const i = flat.findIndex(t => t.id === selected.id)
      setSelectedId(flat[i + 1]?.id ?? flat[i - 1]?.id ?? null)
      setFallbackIndex(i)
    }
  }

  function navigate(params: { month?: string; queue?: boolean }) {
    const q = new URLSearchParams()
    const m = params.month ?? month
    if (m && m !== months[0]?.month) q.set("month", m)
    if (params.queue ?? queue) q.set("queue", "1")
    setPage(0)
    router.push(`${APP_URLS.MONEY_TRANSACTIONS}${q.size ? `?${q}` : ""}`)
  }

  const net = transactions.filter(t => !t.excluded).reduce((a, t) => a + t.amount, 0)
  const accountLabel = accounts.length === 1
    ? `${accounts[0]!.name}${accounts[0]!.ibanLast4 ? ` ES•• ${accounts[0]!.ibanLast4}` : ""}`
    : null

  return (
    <div className="flex flex-col h-full">
      {toast && <div className="fixed top-4 right-4 z-50"><Toast variant={toast.variant} message={toast.message} /></div>}
      {splitFor && (
        <SplitModal
          transaction={splitFor} categories={categories}
          onClose={() => setSplitFor(null)}
          onDone={() => { setSplitFor(null); showToast(T.SAVED) }}
        />
      )}

      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-text">{queue ? T.QUEUE_TITLE : T.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5 truncate">
            {queue ? T.QUEUE_HINT : <>{T.SUBTITLE.replace("{n}", String(top.length)).replace("{sum}", fmtEur(net, { sign: true }))}{accountLabel && ` · ${accountLabel}`}</>}
          </div>
        </div>
        <Link href={APP_URLS.MONEY_IMPORT} className="btn-accent ml-auto shrink-0">{T.IMPORT}</Link>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
        {!queue && (
          <>
            <input
              type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder={T.SEARCH} aria-label={T.SEARCH} className={INPUT_CLS} style={{ width: 220 }}
            />
            <select
              value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0) }}
              aria-label={T.CATEGORY} className={INPUT_CLS} style={{ width: 170 }}
            >
              <option value="">{T.ALL_CATEGORIES}</option>
              {categories.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        )}
        <button
          type="button" onClick={() => navigate({ queue: !queue })}
          className={cn("btn-ghost", uncategorized > 0 && "text-short border-short/40", queue && "bg-short/10")}
        >
          {T.UNCATEGORIZED_N.replace("{n}", String(uncategorized))}
        </button>
        {!queue && (
          <select
            value={month} onChange={e => navigate({ month: e.target.value })}
            aria-label={T.DATE} className={`${INPUT_CLS} ml-auto`} style={{ width: 190 }}
          >
            {months.map(m => <option key={m.month} value={m.month}>{monthLabel(m.month)} · {m.count}</option>)}
            <option value={ALL}>{T.ALL_MONTHS}</option>
          </select>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto page-pad">
        <div className="flex flex-wrap items-start gap-3">
          <div className="card p-0 overflow-x-auto min-w-0" style={{ flex: "999 1 480px" }}>
            {flat.length === 0 ? (
              <div className="px-4 py-16 text-center text-sm text-text-mute">
                {queue ? T.QUEUE_EMPTY : transactions.length ? T.EMPTY_FILTERED : T.EMPTY}
              </div>
            ) : (
              <table className="w-full border-collapse" style={{ minWidth: 620 }}>
                <thead>
                  <tr>
                    <th className="label-caps px-3 py-2.5 border-b border-border text-left" style={{ width: 80 }}>{T.HEAD_DATE}</th>
                    <th className="label-caps px-3 py-2.5 border-b border-border text-left">{T.HEAD_CONCEPT}</th>
                    <th className="label-caps px-3 py-2.5 border-b border-border text-left" style={{ width: 160 }}>{T.HEAD_CATEGORY}</th>
                    <th className="label-caps px-3 py-2.5 border-b border-border text-right" style={{ width: 110 }}>{T.HEAD_AMOUNT}</th>
                    <th className="label-caps px-3 py-2.5 border-b border-border text-right" style={{ width: 110 }}>{T.HEAD_BALANCE}</th>
                  </tr>
                </thead>
                <tbody>
                  {flat.map((t, i) => {
                    const newDay = i === 0 || flat[i - 1]!.bookedAt !== t.bookedAt
                    const isPart = t.parentId != null
                    const isParent = (partsOf.get(t.id)?.length ?? 0) > 0
                    const dim = t.excluded && !isParent
                    return (
                      <Fragment key={t.id}>
                        {newDay && (
                          <tr><td colSpan={5} className="label-caps px-3 pt-3 pb-1">{dayLabel(t.bookedAt)}</td></tr>
                        )}
                        <tr
                          id={`tx-${t.id}`}
                          onClick={() => setSelectedId(t.id)}
                          className={cn(
                            "border-b border-border cursor-pointer transition-colors",
                            selected?.id === t.id ? "bg-surface-2" : "hover:bg-surface-2",
                          )}
                        >
                          <td className="px-3 py-2 mono text-sm text-text-dim whitespace-nowrap">{isPart ? "" : fmtDay(t.bookedAt)}</td>
                          <td className={cn("px-3 py-2 min-w-0", isPart && "pl-8")}>
                            <div className={cn("text-sm font-medium truncate", dim || isParent ? "text-text-mute" : "text-text")}>
                              {isPart && "↳ "}{displayName(t.counterparty)}
                              {isParent && <span className="mono text-xs text-text-mute ml-2 uppercase">{T.TAG_SPLIT}</span>}
                              {dim && <span className="mono text-xs text-text-mute ml-2 uppercase">{T.TAG_EXCLUDED}</span>}
                            </div>
                            {!isPart && <div className="mono text-xs text-text-mute truncate">{t.conceptRaw}{t.notes ? ` · ${t.notes}` : ""}</div>}
                          </td>
                          <td className="px-3 py-2">
                            {!isParent && <CategoryPill category={t.categoryId ? categoriesById.get(t.categoryId) ?? null : null} muted={dim} />}
                          </td>
                          <td className={cn(
                            "px-3 py-2 mono text-sm text-right whitespace-nowrap",
                            dim || isParent ? "text-text-mute line-through decoration-text-mute/50" : t.amount > 0 ? "text-profit" : "text-text",
                          )}>
                            {fmtEur(t.amount, { sign: true })}
                          </td>
                          <td className="px-3 py-2 mono text-sm text-right whitespace-nowrap text-text-mute">
                            {isPart ? "" : fmtEur(t.balanceAfter)}
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-2.5 text-xs text-text-mute">
                <span>
                  {T.SHOWING.replace("{from}", String(currentPage * PAGE_SIZE + 1))
                    .replace("{to}", String(Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE)))
                    .replace("{n}", String(filtered.length))}
                </span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} className="btn-ghost px-2.5 py-1 disabled:opacity-40">{T.PREV}</button>
                  <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} className="btn-ghost px-2.5 py-1 disabled:opacity-40">{T.NEXT}</button>
                </div>
              </div>
            )}
          </div>

          <aside
            className="card p-0 sticky top-0 overflow-y-auto"
            style={{ flex: "1 1 280px", maxWidth: 360, maxHeight: "calc(100dvh - 10rem)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="label-caps">{T.PANEL_TITLE}</span>
            </div>
            {selected ? (
              <TransactionPanel
                key={`${selected.id}|${selected.categoryId}|${selected.categorySource}|${selected.excluded}`}
                ref={selectRef}
                transaction={selected}
                parts={partsOf.get(selected.id)?.length ?? 0}
                categories={categories}
                rules={rules}
                accountName={accountsById.get(selected.accountId)?.name ?? "—"}
                onSaved={onSaved}
                onError={message => showToast(message, "error")}
                onEscape={() => (document.activeElement as HTMLElement | null)?.blur()}
                onSplit={() => setSplitFor(selected)}
              />
            ) : (
              <div className="px-4 py-10 text-center text-sm text-text-mute">{T.PANEL_EMPTY}</div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
