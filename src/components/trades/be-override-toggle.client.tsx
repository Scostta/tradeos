"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { setTradeBeOverride } from "~/actions/trades"
import { TRADES } from "~/constants/copies/trades"
import { cn } from "~/utils/cn"

const C = TRADES.BREAK_EVEN

type Props = {
  tradeId:    string
  breakEven:  boolean
  beOverride: boolean | null
}

// Break-even de un trade: automático por el umbral de Settings, o forzado a
// mano (be_override). Se usa en /review y en /trades/[id]; quien lo monta le
// pasa key={trade.id} para resetear el estado al cambiar de trade.
export function BeOverrideToggle({ tradeId, breakEven, beOverride }: Props): ReactElement {
  const [override, setOverride] = useState<boolean | null>(beOverride)
  const [isBe, setIsBe]         = useState(breakEven)
  const [error, setError]       = useState(false)
  const [pending, startTransition] = useTransition()

  function choose(next: boolean | null) {
    if (next === override) return
    const prev = { override, isBe }
    setOverride(next)
    if (next !== null) setIsBe(next)
    setError(false)
    startTransition(async () => {
      const res = await setTradeBeOverride({ id: tradeId, beOverride: next })
      if (res.success) setIsBe(res.data.breakEven)
      else { setOverride(prev.override); setIsBe(prev.isBe); setError(true) }
    })
  }

  const options: { value: boolean | null; label: string }[] = [
    { value: null,  label: C.AUTO },
    { value: true,  label: C.YES },
    { value: false, label: C.NO },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1" role="group" aria-label={C.LABEL}>
        {options.map(o => (
          <button
            key={String(o.value)} type="button" onClick={() => choose(o.value)} disabled={pending}
            aria-pressed={override === o.value}
            className={cn(
              "px-2.5 h-8 rounded-sm border text-xs cursor-pointer disabled:opacity-60",
              override === o.value ? "border-accent bg-accent/10 text-text" : "border-border text-text-dim hover:border-border-hi",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className={cn("text-xxs", error ? "text-loss" : "text-text-mute")}>
        {error ? C.ERROR : override === null ? C.AUTO_IS.replace("{state}", isBe ? C.STATE_BE : C.STATE_NOT) : C.MANUAL}
      </span>
    </div>
  )
}
