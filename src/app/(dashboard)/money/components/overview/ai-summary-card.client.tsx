"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { generateMoneySummary } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import type { SummaryContent } from "~/lib/finance/ai/summary"
import { SparklesIcon } from "~/lib/ui/icons/sparkles-icon"
import { Spinner } from "~/lib/ui/spinner"
import { cn } from "~/utils/cn"
import { fmtDay } from "../money-format"
import { moneyErrorMessage } from "../money-errors"

const O = MONEY.OVERVIEW

const TONE: Record<SummaryContent["observations"][number]["tone"], string> = {
  positive: "bg-profit",
  info:     "bg-long",
  warning:  "bg-short",
  critical: "bg-loss",
}

// §5.8: resumen del mes con IA. Se genera al pulsar; el guardado se muestra
// tal cual y, si las cifras cambiaron desde entonces, se avisa (stale).
export function AiSummaryCard({ month, initial, stale }: {
  month:   string
  initial: { content: SummaryContent; createdAt: string } | null
  stale:   boolean
}): ReactElement {
  const [summary, setSummary] = useState(initial)
  const [isStale, setIsStale] = useState(stale)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function generate() {
    setError(null)
    startTransition(async () => {
      const res = await generateMoneySummary({ month, refresh: summary != null && !isStale })
      if (res.success) {
        setSummary({ content: res.data.content, createdAt: res.data.createdAt })
        setIsStale(false)
      } else setError(moneyErrorMessage(res.error))
    })
  }

  return (
    <div className="card p-0 flex flex-col min-w-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <SparklesIcon width={14} height={14} className="text-accent" />
        <span className="label-caps">{O.AI_TITLE}</span>
        {summary && (
          <span className={cn("mono text-xs", isStale ? "text-short" : "text-text-mute")}>
            {isStale ? O.AI_STALE : O.AI_GENERATED.replace("{date}", fmtDay(summary.createdAt.slice(0, 10)))}
          </span>
        )}
        <button type="button" onClick={generate} disabled={pending} className="btn-ghost ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-xs disabled:opacity-60">
          {pending && <Spinner />}
          {pending ? O.AI_THINKING : summary ? O.AI_REFRESH : O.AI_GENERATE}
        </button>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        {error && <p className="text-sm text-loss">{error}</p>}
        {summary ? (
          <>
            {summary.content.observations.map((o, i) => (
              <div key={i} className="flex gap-2.5">
                <span className={cn("size-2 rounded-full mt-1.5 shrink-0", TONE[o.tone])} />
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-text">{o.title}</span>
                  <span className="text-sm text-text-dim">{o.detail}</span>
                  <span className="mono text-xs text-text-mute">{o.metric}</span>
                </div>
              </div>
            ))}
            <span className="text-xs text-text-mute">{O.AI_DISCLAIMER}</span>
          </>
        ) : (
          !error && <p className="text-sm text-text-mute">{O.AI_EMPTY}</p>
        )}
      </div>
    </div>
  )
}
