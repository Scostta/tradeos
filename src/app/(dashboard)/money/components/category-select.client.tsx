"use client"

import { forwardRef } from "react"
import type { KeyboardEvent } from "react"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"
import type { CategoryKind, FinanceCategory } from "~/types/finance"

const T = MONEY.TRANSACTIONS
const KIND_ORDER: CategoryKind[] = ["expense", "income", "savings", "transfer"]

type Props = {
  categories:  FinanceCategory[]
  value:       string | null
  onChange:    (id: string | null) => void
  allowEmpty?: boolean
  onKeyDown?:  (e: KeyboardEvent<HTMLSelectElement>) => void
  id?:         string
}

/** Select de categorías agrupado por tipo; las archivadas solo si son la actual. */
export const CategorySelect = forwardRef<HTMLSelectElement, Props>(function CategorySelect(
  { categories, value, onChange, allowEmpty = true, onKeyDown, id },
  ref,
) {
  const visible = categories.filter(c => !c.archived || c.id === value)
  return (
    <select
      ref={ref}
      id={id}
      value={value ?? ""}
      onChange={e => onChange(e.target.value || null)}
      onKeyDown={onKeyDown}
      className={INPUT_CLS}
    >
      {allowEmpty && <option value="">{T.NO_CATEGORY}</option>}
      {KIND_ORDER.map(kind => {
        const group = visible.filter(c => c.kind === kind)
        if (group.length === 0) return null
        return (
          <optgroup key={kind} label={T.KIND_GROUPS[kind]}>
            {group.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        )
      })}
    </select>
  )
})
