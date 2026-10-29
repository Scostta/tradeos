"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import Link from "next/link"
import { generateRunPicks } from "~/actions/invest-ai"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import type { PicksContent } from "~/lib/invest/ai/picks"
import { distanceToSma } from "~/lib/calculations/invest-run"
import { SparklesIcon } from "~/lib/ui/icons/sparkles-icon"
import { Spinner } from "~/lib/ui/spinner"
import type { ScreenResult } from "~/types/invest"
import { cn } from "~/utils/cn"
import { fmtPct } from "./invest-format"
import { investErrorMessage } from "./invest-errors"
import { sectorColor } from "./heat"

const S = INVEST.SCREEN

function Meter({ label, value, ratio, color }: { label: string; value: string; ratio: number | null; color: string }): ReactElement {
  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns: "84px 1fr 56px" }}>
      <span className="text-xs text-text-mute">{label}</span>
      <span className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, (ratio ?? 0) * 100))}%`, background: color }} />
      </span>
      <span className="mono text-xs text-text text-right">{value}</span>
    </div>
  )
}

// §4.8: lectura de la IA sobre los que pasan el run vigente. Cada destacado es
// una tarjeta: las cifras del run como barras (no las escribe la IA), el
// porqué en una línea y el riesgo como etiqueta. Se genera al pulsar.
export function AiPicksCard({ runId, initial, stale, results, sectorOrder }: {
  runId:       string
  initial:     { content: PicksContent; createdAt: string } | null
  stale:       boolean
  results:     ScreenResult[]          // los que pasan, para las barras
  sectorOrder: string[]
}): ReactElement {
  const [note, setNote] = useState(initial)
  const [isStale, setIsStale] = useState(stale)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const byTicker = new Map(results.map(r => [r.ticker, r]))

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 border-b border-border">
        <SparklesIcon width={14} height={14} className="text-accent" />
        <span className="label-caps">{note ? S.AI_TITLE_N.replace("{n}", String(note.content.highlights.length)) : S.AI_TITLE}</span>
        {note && <span className="text-sm text-text-dim">{note.content.overview}</span>}
        <span className={cn("mono text-xs ml-auto", isStale ? "text-short" : "text-text-mute")}>
          {note ? (isStale ? S.AI_STALE : S.AI_GENERATED.replace("{date}", note.createdAt.slice(0, 10))) : null}
        </span>
        <button type="button" onClick={generate} disabled={pending} className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-xs disabled:opacity-60">
          {pending && <Spinner size={10} />}
          {pending ? S.AI_THINKING : note ? S.AI_REFRESH : S.AI_GENERATE}
        </button>
      </div>

      {error && <p className="px-4 pt-3 text-sm text-loss">{error}</p>}
      {note ? (
        <div className="grid gap-3 p-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {note.content.highlights.map(h => {
            const r = byTicker.get(h.ticker)
            const vsSma = r ? distanceToSma(r.price, r.sma10m) : null
            const gmDelta = r?.grossMargin != null && r.grossMarginPrev != null ? (r.grossMargin - r.grossMarginPrev) * 100 : null
            const stretched = (vsSma ?? 0) > 0.3
            return (
              <article key={h.ticker} className="rounded-md border border-border bg-bg p-3.5 flex flex-col gap-3 min-w-0">
                <div className="flex items-start gap-2">
                  <div className="min-w-0">
                    <Link href={APP_URLS.INVEST_TICKER(h.ticker)} className="mono text-xl font-semibold text-text hover:text-accent leading-none">{h.ticker}</Link>
                    {r?.name && <div className="text-xs text-text-mute truncate mt-1">{r.name}</div>}
                  </div>
                  {r?.sector && (
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-sm bg-surface-2 whitespace-nowrap" style={{ color: sectorColor(r.sector, sectorOrder) }}>
                      {r.sector}
                    </span>
                  )}
                </div>
                {r && (
                  <div className="flex flex-col gap-1.5">
                    <Meter label={S.M_GROWTH} value={fmtPct(r.revenueGrowthYoy)} ratio={r.revenueGrowthYoy == null ? null : r.revenueGrowthYoy / 0.6} color="var(--color-accent)" />
                    <Meter label={S.M_GM} value={gmDelta == null ? "—" : `${gmDelta >= 0 ? "+" : ""}${gmDelta.toFixed(1)} pts`} ratio={gmDelta == null ? null : gmDelta / 20} color="var(--color-accent)" />
                    <Meter label={S.M_ROIC} value={fmtPct(r.roic)} ratio={r.roic == null ? null : r.roic / 0.5} color="var(--color-accent)" />
                    <Meter label={S.M_RS} value={fmtPct(r.relStrength6m, { sign: true })} ratio={r.relStrength6m == null ? null : r.relStrength6m / 0.6} color="var(--color-long)" />
                    <Meter
                      label={S.M_SMA} value={fmtPct(vsSma, { sign: true })} ratio={vsSma == null ? null : vsSma / 0.6}
                      color={stretched ? "var(--color-short)" : "var(--color-long)"}
                    />
                  </div>
                )}
                <p className="text-sm text-text">{h.why}</p>
                <div className="flex items-center gap-2 mt-auto">
                  <span className="text-xs text-short bg-short/10 rounded-sm px-2 py-0.5 min-w-0">{S.AI_RISK.replace("{risk}", h.risk)}</span>
                  <Link href={APP_URLS.INVEST_TICKER(h.ticker)} className="ml-auto text-xs text-text-mute hover:text-text whitespace-nowrap">{S.AI_DETAIL}</Link>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        !error && <p className="px-4 py-3 text-sm text-text-mute">{S.AI_EMPTY}</p>
      )}
      {note && <span className="px-4 pb-3 text-xs text-text-mute">{S.AI_DISCLAIMER}</span>}
    </div>
  )
}
