"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { generatePositionReview } from "~/actions/invest-ai"
import { INVEST } from "~/constants/copies/invest"
import type { ReviewContent } from "~/lib/invest/ai/review"
import { SparklesIcon } from "~/lib/ui/icons/sparkles-icon"
import { Spinner } from "~/lib/ui/spinner"
import { cn } from "~/utils/cn"
import { investErrorMessage } from "../../../components/invest-errors"

const D = INVEST.POSITION

const VERDICT_CLS: Record<ReviewContent["falsifiers"][number]["verdict"], string> = {
  likely:  "bg-loss/10 text-loss",
  not_yet: "bg-profit/10 text-profit",
  unclear: "bg-surface-2 text-text-dim",
}

// §4.8: revisión de los falsadores con los datos del run vigente. Solo opina:
// el estado de cada falsador lo marca el usuario en la tarjeta de la tesis.
export function AiReviewCard({ runId, positionId, falsifiers, initial, stale }: {
  runId:      string
  positionId: string
  falsifiers: string[]
  initial:    { content: ReviewContent; createdAt: string } | null
  stale:      boolean
}): ReactElement {
  const [review, setReview] = useState(initial)
  const [isStale, setIsStale] = useState(stale)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function generate() {
    setError(null)
    startTransition(async () => {
      const res = await generatePositionReview({ runId, positionId, refresh: review != null && !isStale })
      if (res.success) {
        setReview({ content: res.data.content, createdAt: res.data.createdAt })
        setIsStale(false)
      } else setError(investErrorMessage(res.error))
    })
  }

  return (
    <div className="card p-0 flex flex-col min-w-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <SparklesIcon width={14} height={14} className="text-accent" />
        <span className="label-caps">{D.AI_TITLE}</span>
        {review && (
          <span className={cn("mono text-xs", isStale ? "text-short" : "text-text-mute")}>
            {isStale ? D.AI_STALE : D.AI_GENERATED.replace("{date}", review.createdAt.slice(0, 10))}
          </span>
        )}
        <button type="button" onClick={generate} disabled={pending} className="btn-ghost ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-xs disabled:opacity-60">
          {pending && <Spinner size={10} />}
          {pending ? D.AI_THINKING : review ? D.AI_REFRESH : D.AI_GENERATE}
        </button>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        {error && <p className="text-sm text-loss">{error}</p>}
        {review ? (
          <>
            <p className="text-sm text-text-dim">{review.content.summary}</p>
            {review.content.falsifiers.map(f => (
              <div key={f.index} className="flex flex-col gap-1">
                <div className="flex items-start gap-2">
                  <span className="mono text-xs text-text-mute mt-0.5">{f.index + 1}</span>
                  <span className="text-sm text-text flex-1 min-w-0">{falsifiers[f.index] ?? ""}</span>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-sm whitespace-nowrap", VERDICT_CLS[f.verdict])}>{D.AI_VERDICT[f.verdict]}</span>
                </div>
                <span className="mono text-xs text-text-mute pl-5">{f.evidence}</span>
                {f.note && <span className="text-xs text-text-dim pl-5">{f.note}</span>}
              </div>
            ))}
            <span className="text-xs text-text-mute">{D.AI_DISCLAIMER}</span>
          </>
        ) : (
          !error && <p className="text-sm text-text-mute">{D.AI_EMPTY}</p>
        )}
      </div>
    </div>
  )
}
