"use client"

import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import { SparklesIcon } from "~/lib/ui/icons/sparkles-icon"
import type { FinanceCategory } from "~/types/finance"
import { cn } from "~/utils/cn"

const T = MONEY.TRANSACTIONS

export type Suggestion = {
  categoryId:  string | null
  confidence:  "high" | "medium" | "low"
  rulePattern: string | null
  reason:      string
}

// §5.8: sugerencia de la IA bajo la categoría de un movimiento de la cola.
// Aceptar la guarda (con la regla si la trae); descartar solo la oculta.
export function AiSuggestion({ suggestion, category, pending, onAccept, onDismiss }: {
  suggestion: Suggestion
  category:   FinanceCategory | null
  pending:    boolean
  onAccept:   () => void
  onDismiss:  () => void
}): ReactElement {
  const tone = { high: "text-profit", medium: "text-short", low: "text-text-mute" }[suggestion.confidence]
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs" title={suggestion.reason} onClick={e => e.stopPropagation()}>
      <SparklesIcon width={12} height={12} className="text-accent shrink-0" />
      {category ? (
        <>
          <span className="text-text">{category.name}</span>
          <span className={cn("mono", tone)}>{T.AI_CONFIDENCE[suggestion.confidence]}</span>
          {suggestion.rulePattern && <span className="mono text-text-mute">{T.AI_RULE.replace("{pattern}", suggestion.rulePattern)}</span>}
          <button type="button" disabled={pending} onClick={onAccept} className="btn-ghost px-2 py-0.5 text-xs text-accent border-accent/40 disabled:opacity-60">
            {T.AI_ACCEPT}
          </button>
        </>
      ) : (
        <span className="text-text-mute">{T.AI_NONE}</span>
      )}
      <button type="button" disabled={pending} onClick={onDismiss} className="text-text-mute hover:text-text-dim cursor-pointer disabled:opacity-60">
        {T.AI_DISMISS}
      </button>
    </div>
  )
}
