import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import type { FinanceCategory } from "~/types/finance"
import { cn } from "~/utils/cn"

/** Badge de categoría con su color; sin categoría, ámbar ("Uncategorized"). */
export function CategoryPill({ category, muted }: { category: FinanceCategory | null; muted?: boolean }): ReactElement {
  if (!category) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs border border-short/40 text-short whitespace-nowrap">
        {MONEY.IMPORT.UNCATEGORIZED}
      </span>
    )
  }
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs border border-border bg-surface-2 whitespace-nowrap",
      muted ? "text-text-mute" : "text-text-dim",
    )}>
      <span className="size-1.5 rounded-full shrink-0" style={{ background: category.color }} />
      {category.name}
    </span>
  )
}
