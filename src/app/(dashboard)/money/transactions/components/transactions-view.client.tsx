"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import type { ReactElement } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { categorizeTransaction, suggestTransactionCategories } from "~/actions/finance"
import { APP_URLS } from "~/constants/app-urls"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"
import { SparklesIcon } from "~/lib/ui/icons/sparkles-icon"
import { XIcon } from "~/lib/ui/icons/x-icon"
import { Spinner } from "~/lib/ui/spinner"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { CategorizeResult, FinanceAccount, FinanceCategory, FinanceRule, FinanceTransaction } from "~/types/finance"
import { cn } from "~/utils/cn"
import { AddCashButton } from "../../components/add-cash-button.client"
import { CategoryPill } from "../../components/category-pill"
import { displayName, fmtDay, fmtEur } from "../../components/money-format"
import { moneyErrorMessage } from "../../components/money-errors"
import { AiSuggestion } from "./ai-suggestion.client"
import type { Suggestion } from "./ai-suggestion.client"
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
  initialCategory: string             // ?category=<id>
  aiEnabled:     boolean              // §5.8: hay ANTHROPIC_API_KEY
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
}

function dayLabel(iso: string): string {
  const weekday = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
  return `${weekday} · ${fmtDay(iso)}`
}

function amountCls(t: FinanceTransaction, isParent: boolean, dim: boolean): string {
  return dim || isParent ? "text-text-mute line-through decoration-text-mute/50" : t.amount > 0 ? "text-profit" : "text-text"
}

function Name({ t, isPart, isParent, dim }: { t: FinanceTransaction; isPart: boolean; isParent: boolean; dim: boolean }): ReactElement {
  return (
    <div className={cn("text-sm font-medium truncate", dim || isParent ? "text-text-mute" : "text-text")}>
      {isPart && "↳ "}{displayName(t.counterparty)}
      {isParent && <span className="mono text-xs text-text-mute ml-2 uppercase">{T.TAG_SPLIT}</span>}
      {dim && <span className="mono text-xs text-text-mute ml-2 uppercase">{T.TAG_EXCLUDED}</span>}
    </div>
  )
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

// §5.2 (artboard 02): tabla por días, filtros y panel lateral. En modo cola,
// ↑↓ mueven la selección, Enter abre la categoría, Enter guarda y pasa al
// siguiente, Esc vuelve a la lista. En móvil la tabla pasa a filas compactas y
// el panel se abre como hoja al tocar una fila (en la cola, abierta de inicio).
export function TransactionsView(props: Props): ReactElement {
  const { transactions, categories, rules, accounts, months, month, queue, uncategorized, initialCategory, aiEnabled } = props
  const router = useRouter()
  const selectRef = useRef<HTMLSelectElement>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState(initialCategory)
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(queue ? transactions[0]?.id ?? null : null)
  const [splitFor, setSplitFor] = useState<FinanceTransaction | null>(null)
  const [sheetOpen, setSheetOpen] = useState(queue)          // panel como hoja (solo móvil)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [suggestions, setSuggestions] = useState<Map<string, Suggestion>>(new Map())
  const [aiBusy, setAiBusy] = useState<"suggest" | "accept" | null>(null)

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
  const rows = flat.map((t, i) => {
    const isParent = (partsOf.get(t.id)?.length ?? 0) > 0
    return { t, newDay: i === 0 || flat[i - 1]!.bookedAt !== t.bookedAt, isPart: t.parentId != null, isParent, dim: t.excluded && !isParent }
  })

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
    if (!selected) return
    const rows = document.querySelectorAll<HTMLElement>(`[data-tx="${selected.id}"]`)
    ;[...rows].find(r => r.offsetParent)?.scrollIntoView({ block: "nearest" })
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

  function onDeleted() {
    showToast(T.DELETED)
    if (selected) {
      const i = flat.findIndex(t => t.id === selected.id)
      setSelectedId(flat[i + 1]?.id ?? flat[i - 1]?.id ?? null)
      setFallbackIndex(i)
    }
  }

  // §5.8: sugerencias para los movimientos sin categorizar de la página.
  async function suggest() {
    const ids = flat.filter(t => !t.parentId && t.categoryId == null && !t.excluded).map(t => t.id)
    if (ids.length === 0 || aiBusy) return
    setAiBusy("suggest")
    const res = await suggestTransactionCategories({ transactionIds: ids })
    setAiBusy(null)
    if (!res.success) { showToast(moneyErrorMessage(res.error), "error"); return }
    if (res.data.suggestions.length === 0) { showToast(T.AI_NO_SUGGESTIONS); return }
    setSuggestions(new Map(res.data.suggestions.map(s => [s.transactionId, s])))
  }

  function dropSuggestion(id: string) {
    setSuggestions(prev => { const next = new Map(prev); next.delete(id); return next })
  }

  /** Acepta en orden: cada regla creada puede categorizar otros de la lista (el refresco los quita). */
  async function accept(ids: string[]) {
    if (aiBusy) return
    setAiBusy("accept")
    let done = 0
    for (const id of ids) {
      const s = suggestions.get(id)
      const t = transactions.find(x => x.id === id)
      if (!s?.categoryId || !t) continue
      const res = await categorizeTransaction({ transactionId: id, categoryId: s.categoryId, notes: t.notes, excluded: false, rulePattern: s.rulePattern })
      if (!res.success) { showToast(moneyErrorMessage(res.error), "error"); break }
      done++
      dropSuggestion(id)
    }
    setAiBusy(null)
    if (done > 0) showToast(T.AI_ACCEPTED.replace("{n}", String(done)))
  }

  const highIds = [...suggestions.entries()]
    .filter(([id, s]) => s.confidence === "high" && s.categoryId && flat.some(t => t.id === id && t.categoryId == null))
    .map(([id]) => id)

  const aiChip = (t: FinanceTransaction) => {
    const s = t.categoryId == null ? suggestions.get(t.id) : undefined
    if (!s) return null
    return (
      <AiSuggestion
        suggestion={s} category={s.categoryId ? categoriesById.get(s.categoryId) ?? null : null} pending={aiBusy != null}
        onAccept={() => void accept([t.id])} onDismiss={() => dropSuggestion(t.id)}
      />
    )
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
        <div className="ml-auto flex items-center gap-2.5 shrink-0">
          <AddCashButton />
          <Link href={APP_URLS.MONEY_IMPORT} className="btn-accent">{T.IMPORT}</Link>
        </div>
      </header>

      {/* Móvil: búsqueda + cola arriba, categoría y mes a medias debajo. Escritorio: una fila. */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
        {!queue && (
          <input
            type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder={T.SEARCH} aria-label={T.SEARCH} className={cn(INPUT_CLS, "flex-1 min-w-0 md:flex-none md:w-55")}
          />
        )}
        <button
          type="button" onClick={() => navigate({ queue: !queue })}
          className={cn("btn-ghost shrink-0 whitespace-nowrap md:order-2", uncategorized > 0 && "text-short border-short/40", queue && "bg-short/10")}
        >
          {T.UNCATEGORIZED_N.replace("{n}", String(uncategorized))}
        </button>
        {queue && aiEnabled && flat.length > 0 && (
          <>
            <button type="button" onClick={() => void suggest()} disabled={aiBusy != null} className="btn-ghost inline-flex items-center gap-1.5 disabled:opacity-60">
              {aiBusy === "suggest" ? <Spinner /> : <SparklesIcon width={14} height={14} className="text-accent" />}
              {aiBusy === "suggest" ? T.AI_SUGGESTING : T.AI_SUGGEST}
            </button>
            {highIds.length > 0 && (
              <button type="button" onClick={() => void accept(highIds)} disabled={aiBusy != null} className="btn-accent disabled:opacity-60">
                {T.AI_ACCEPT_HIGH.replace("{n}", String(highIds.length))}
              </button>
            )}
            {suggestions.size > 0 && <span className="text-xs text-text-mute">{T.AI_LABEL}</span>}
          </>
        )}
        {!queue && (
          <div className="flex gap-2 w-full md:contents">
            <select
              value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0) }}
              aria-label={T.CATEGORY} className={cn(INPUT_CLS, "flex-1 min-w-0 md:flex-none md:w-42.5 md:order-1")}
            >
              <option value="">{T.ALL_CATEGORIES}</option>
              {categories.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={month} onChange={e => navigate({ month: e.target.value })}
              aria-label={T.DATE} className={cn(INPUT_CLS, "flex-1 min-w-0 md:flex-none md:w-47.5 md:order-3 md:ml-auto")}
            >
              {months.map(m => <option key={m.month} value={m.month}>{monthLabel(m.month)} · {m.count}</option>)}
              <option value={ALL}>{T.ALL_MONTHS}</option>
            </select>
          </div>
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
<>
              <table className="hidden md:table w-full border-collapse" style={{ minWidth: 620 }}>
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
                  {rows.map(({ t, newDay, isPart, isParent, dim }) => {
                    return (
                      <Fragment key={t.id}>
                        {newDay && (
                          <tr><td colSpan={5} className="label-caps px-3 pt-3 pb-1">{dayLabel(t.bookedAt)}</td></tr>
                        )}
                        <tr
                          data-tx={t.id}
                          onClick={() => setSelectedId(t.id)}
                          className={cn(
                            "border-b border-border cursor-pointer transition-colors",
                            selected?.id === t.id ? "bg-surface-2" : "hover:bg-surface-2",
                          )}
                        >
                          <td className="px-3 py-2 mono text-sm text-text-dim whitespace-nowrap">{isPart ? "" : fmtDay(t.bookedAt)}</td>
                          <td className={cn("px-3 py-2 min-w-0", isPart && "pl-8")}>
                            <Name t={t} isPart={isPart} isParent={isParent} dim={dim} />
                            {!isPart && <div className="mono text-xs text-text-mute truncate">{t.conceptRaw}{t.notes ? ` · ${t.notes}` : ""}</div>}
                          </td>
                          <td className="px-3 py-2">
                            {!isParent && <CategoryPill category={t.categoryId ? categoriesById.get(t.categoryId) ?? null : null} muted={dim} />}
                            {aiChip(t) && <div className="mt-1">{aiChip(t)}</div>}
                          </td>
                          <td className={cn("px-3 py-2 mono text-sm text-right whitespace-nowrap", amountCls(t, isParent, dim))}>
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

              <div className="md:hidden">
                {rows.map(({ t, newDay, isPart, isParent, dim }) => (
                  <Fragment key={t.id}>
                    {newDay && <div className="label-caps px-3 pt-3 pb-1">{dayLabel(t.bookedAt)}</div>}
                    <div className={cn("border-b border-border", selected?.id === t.id && "bg-surface-2")}>
                    <button
                      type="button" data-tx={t.id}
                      onClick={() => { setSelectedId(t.id); setSheetOpen(true) }}
                      className={cn("w-full text-left flex flex-col gap-1 px-3 py-2.5 cursor-pointer", isPart && "pl-8")}
                    >
                      <div className="flex items-baseline gap-3">
                        <div className="flex-1 min-w-0"><Name t={t} isPart={isPart} isParent={isParent} dim={dim} /></div>
                        <span className={cn("mono text-sm whitespace-nowrap", amountCls(t, isParent, dim))}>{fmtEur(t.amount, { sign: true })}</span>
                      </div>
                      {!isParent && (
                        <div className="flex items-center gap-2 min-w-0">
                          <CategoryPill category={t.categoryId ? categoriesById.get(t.categoryId) ?? null : null} muted={dim} />
                          {!isPart && <span className="mono text-xs text-text-mute truncate min-w-0">{t.conceptRaw}{t.notes ? ` · ${t.notes}` : ""}</span>}
                        </div>
                      )}
                      {isParent && <span className="mono text-xs text-text-mute truncate">{t.conceptRaw}</span>}
                    </button>
                    {aiChip(t) && <div className="px-3 pb-2.5 -mt-1">{aiChip(t)}</div>}
                    </div>
                  </Fragment>
                ))}
              </div>
              </>
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

          {/* En escritorio el envoltorio no existe (md:contents); en móvil es el fondo de la hoja. */}
          <div
            className={cn("md:contents", sheetOpen && selected ? "max-md:fixed max-md:inset-0 max-md:z-50 max-md:flex max-md:items-end max-md:bg-black/60 max-md:p-4" : "max-md:hidden")}
            onClick={() => setSheetOpen(false)}
          >
          <aside
            className="card p-0 md:sticky top-0 overflow-y-auto w-full md:max-w-90 max-md:mb-4"
            style={{ flex: "1 1 280px", maxHeight: "calc(100dvh - 10rem)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="label-caps">{T.PANEL_TITLE}</span>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label={T.PANEL_CLOSE} className="md:hidden text-text-mute cursor-pointer">
                <XIcon className="size-4" />
              </button>
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
                onDeleted={onDeleted}
              />
            ) : (
              <div className="px-4 py-10 text-center text-sm text-text-mute">{T.PANEL_EMPTY}</div>
            )}
          </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
