"use client"

import { forwardRef, useState, useTransition } from "react"
import type { KeyboardEvent, ReactElement, ReactNode } from "react"
import { categorizeTransaction, unsplitTransaction } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import { matchRule } from "~/lib/finance/match-rule"
import { INPUT_CLS } from "~/lib/ui/form"
import { Spinner } from "~/lib/ui/spinner"
import type { CategorizeResult, FinanceCategory, FinanceRule, FinanceTransaction } from "~/types/finance"
import { CategorySelect } from "../../components/category-select.client"
import { displayName, fmtDay, fmtEur } from "../../components/money-format"
import { moneyErrorMessage } from "../../components/money-errors"

const T = MONEY.TRANSACTIONS

function Stat({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="min-w-0">
      <div className="label-caps">{label}</div>
      <div className="text-md text-text mt-1 truncate">{children}</div>
    </div>
  )
}

type Props = {
  transaction: FinanceTransaction
  parts:       number              // partes si es el padre de un split
  categories:  FinanceCategory[]
  rules:       FinanceRule[]
  accountName: string
  onSaved:     (result: CategorizeResult) => void
  onError:     (message: string) => void
  onEscape:    () => void
  onSplit:     () => void
}

// §5.2 panel lateral (artboard 02). Se monta con key = id del movimiento, así
// que su estado se reinicia al cambiar de selección (sin efectos).
export const TransactionPanel = forwardRef<HTMLSelectElement, Props>(function TransactionPanel(
  { transaction: t, parts, categories, rules, accountName, onSaved, onError, onEscape, onSplit },
  selectRef,
) {
  const isPart = t.parentId != null
  const isSplitParent = parts > 0
  const [categoryId, setCategoryId] = useState<string | null>(t.categoryId)
  const [notes, setNotes] = useState(t.notes ?? "")
  const [excluded, setExcluded] = useState(t.excluded)
  const [pattern, setPattern] = useState(t.counterparty ?? "")
  const [createRule, setCreateRule] = useState(!isPart && !!t.counterparty && t.categorySource !== "rule")
  const [pending, startTransition] = useTransition()

  const byId = new Map(categories.map(c => [c.id, c]))
  const appliedRule = !isSplitParent && t.categorySource === "rule" && categoryId === t.categoryId
    ? matchRule(t.counterparty, rules)
    : null
  const ruleInfo = appliedRule ? rules.find(r => r.id === appliedRule.id) ?? null : null
  const canCreateRule = !isPart && !isSplitParent && categoryId != null && !ruleInfo && pattern.trim().length >= 2

  function save() {
    if (pending) return
    startTransition(async () => {
      const res = await categorizeTransaction({
        transactionId: t.id,
        categoryId,
        notes:       notes.trim() || null,
        excluded:    isSplitParent ? true : excluded,
        rulePattern: canCreateRule && createRule ? pattern.trim() : null,
      })
      if (res.success) onSaved(res.data)
      else onError(moneyErrorMessage(res.error))
    })
  }

  function unsplit() {
    startTransition(async () => {
      const res = await unsplitTransaction({ transactionId: t.id })
      if (!res.success) onError(moneyErrorMessage(res.error))
    })
  }

  function onSelectKey(e: KeyboardEvent<HTMLSelectElement>) {
    if (e.key === "Enter") { e.preventDefault(); save() }
    if (e.key === "Escape") { e.preventDefault(); e.currentTarget.blur(); onEscape() }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="min-w-0">
        <div className="text-2xl font-semibold tracking-tight text-text truncate">{displayName(t.counterparty)}</div>
        <div className="mono text-xs text-text-mute truncate">{t.conceptRaw}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label={T.AMOUNT}><span className={`mono ${t.amount > 0 ? "text-profit" : ""}`}>{fmtEur(t.amount, { sign: true })}</span></Stat>
        <Stat label={T.DATE}><span className="mono">{fmtDay(t.bookedAt, { year: true })}</span></Stat>
        <Stat label={T.ACCOUNT}>{accountName}</Stat>
        <Stat label={T.SOURCE}>{t.source === "import" ? T.SOURCE_IMPORT : T.SOURCE_MANUAL}</Stat>
      </div>

      {isSplitParent ? (
        <div className="rounded-md border border-border bg-bg px-3 py-2.5 text-sm text-text-dim flex items-center justify-between gap-2">
          <span>{T.SPLIT_PARENT.replace("{n}", String(parts))}</span>
          <button type="button" onClick={unsplit} disabled={pending} className="text-xs underline hover:text-text shrink-0">{T.UNSPLIT}</button>
        </div>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">{T.CATEGORY}</span>
          <CategorySelect ref={selectRef} categories={categories} value={categoryId} onChange={setCategoryId} onKeyDown={onSelectKey} />
          {isPart && <span className="text-xs text-text-mute">{T.PART_OF_SPLIT}</span>}
        </label>
      )}

      {ruleInfo && (
        <div className="rounded-md border border-accent/25 bg-accent/5 px-3 py-2.5 flex flex-col gap-1.5">
          <span className="label-caps text-accent">{T.RULE_APPLIED}</span>
          <span className="text-sm text-text">
            {T.RULE_TEXT.split("{pattern}")[0]}
            <span className="mono bg-surface-2 px-1 rounded-sm">{ruleInfo.pattern}</span>
            {T.RULE_TEXT.split("{pattern}")[1]!.replace("{category}", byId.get(ruleInfo.categoryId)?.name ?? "—")}
          </span>
          <span className="text-xs text-text-mute">
            {T.RULE_META.replace("{date}", fmtDay(ruleInfo.createdAt.slice(0, 10))).replace("{n}", String(ruleInfo.hits))}
          </span>
        </div>
      )}

      {!ruleInfo && !isPart && !isSplitParent && categoryId != null && (
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm text-text-dim cursor-pointer">
            <input type="checkbox" checked={createRule} onChange={e => setCreateRule(e.target.checked)} className="accent-accent" />
            {T.CREATE_RULE}
            <input
              value={pattern} onChange={e => setPattern(e.target.value)} disabled={!createRule}
              className={`${INPUT_CLS} mono py-1 flex-1 min-w-0 disabled:opacity-50`}
            />
          </label>
          {createRule && <span className="text-xs text-text-mute">{T.RULE_HINT}</span>}
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="label-caps">{T.NOTE}</span>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={T.NOTE_PLACEHOLDER} maxLength={500} className={INPUT_CLS} />
      </label>

      {!isPart && !isSplitParent && (
        <label className="flex items-center gap-2 text-sm text-text-dim cursor-pointer">
          <input type="checkbox" checked={excluded} onChange={e => setExcluded(e.target.checked)} className="accent-accent" />
          {T.EXCLUDE}
        </label>
      )}

      <div className="flex gap-2">
        <button
          type="button" onClick={save} disabled={pending}
          className="btn-accent flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {pending ? <><Spinner />{T.SAVING}</> : T.SAVE}
        </button>
        {!isPart && (
          <button type="button" onClick={onSplit} disabled={pending} className="btn-ghost">{T.SPLIT}</button>
        )}
      </div>
    </div>
  )
})
