"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import Link from "next/link"
import { generateRunPicks } from "~/actions/invest-ai"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import type { PicksContent } from "~/lib/invest/ai/picks"
import { SparklesIcon } from "~/lib/ui/icons/sparkles-icon"
import { Spinner } from "~/lib/ui/spinner"
import { cn } from "~/utils/cn"
import { investErrorMessage } from "./invest-errors"

const S = INVEST.SCREEN

// §4.8: comentario de la IA sobre los tickers que pasan el run vigente. Se
// genera al pulsar; si los datos cambiaron desde el guardado, se avisa.
export function AiPicksCard({ runId, initial, stale }: {
  runId:   string
  initial: { content: PicksContent; createdAt: string } | null
  stale:   boolean
}): ReactElement {
  const [note, setNote] = useState(initial)
  const [isStale, setIsStale] = useState(stale)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function generate() {
    setError(null)
    startTransition(async () => {
      const res = await generateRunPicks({ runId, refresh: note != null && !isStale })
      if (res.success) {
        setNote({ content: res.data.content, createdAt: res.data.createdAt })
        setIsStale(false)
      } else setError(investErrorMessage(res.error))
    })
  }

  return (
    <div className="card p-0 flex flex-col min-w-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <SparklesIcon width={14} height={14} className="text-accent" />
        <span className="label-caps">{S.AI_TITLE}</span>
        {note && (
          <span className={cn("mono text-xs", isStale ? "text-short" : "text-text-mute")}>
            {isStale ? S.AI_STALE : S.AI_GENERATED.replace("{date}", note.createdAt.slice(0, 10))}
          </span>
        )}
        <button type="button" onClick={generate} disabled={pending} className="btn-ghost ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-xs disabled:opacity-60">
          {pending && <Spinner size={10} />}
          {pending ? S.AI_THINKING : note ? S.AI_REFRESH : S.AI_GENERATE}
        </button>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        {error && <p className="text-sm text-loss">{error}</p>}
        {note ? (
          <>
            <p className="text-sm text-text-dim">{note.content.overview}</p>
            {note.content.highlights.map(h => (
              <div key={h.ticker} className="flex flex-col gap-0.5">
                <Link href={APP_URLS.INVEST_TICKER(h.ticker)} className="mono text-sm font-semibold text-text hover:text-accent w-fit">{h.ticker}</Link>
                <span className="text-sm text-text-dim">{h.why}</span>
                <span className="mono text-xs text-text-mute">{h.metric}</span>
                <span className="text-xs text-short">{S.AI_RISK.replace("{risk}", h.risk)}</span>
              </div>
            ))}
            <span className="text-xs text-text-mute">{S.AI_DISCLAIMER}</span>
          </>
        ) : (
          !error && <p className="text-sm text-text-mute">{S.AI_EMPTY}</p>
        )}
      </div>
    </div>
  )
}
