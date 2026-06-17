"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { ReactElement } from "react"
import { generateInsights } from "~/actions/insights"
import { INSIGHTS } from "~/constants/copies/insights"
import { APP_URLS } from "~/constants/app-urls"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import { SparklesIcon } from "~/lib/ui/icons/sparkles-icon"
import type { Insight, InsightSeverity, InsightCategory, InsightsView } from "~/types/insights"

const SEVERITY: Record<InsightSeverity, { color: string; label: string }> = {
  critical: { color: "var(--color-loss)",      label: "Critical" },
  warning:  { color: "#f59e0b",                 label: "Warning"  },
  info:     { color: "var(--color-accent)",     label: "Info"     },
  positive: { color: "var(--color-profit)",     label: "Strength" },
}

const COMPACT_LIMIT = 3
const CATEGORY_ORDER: InsightCategory[] = ["discipline", "timing", "risk", "strategy"]

function InsightItem({ insight }: { insight: Insight }): ReactElement {
  const sev = SEVERITY[insight.severity]
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3 flex gap-3">
      <span className="w-1.5 rounded-full shrink-0" style={{ background: sev.color }} />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-md font-semibold text-text">{insight.title}</span>
          <span className="label-caps shrink-0" style={{ color: sev.color }}>{sev.label}</span>
          <span className="label-caps text-text-mute shrink-0">· {INSIGHTS.CATEGORY[insight.category]}</span>
        </div>
        <p className="text-sm text-text-dim">{insight.detail}</p>
        {insight.metric && <span className="mono text-xs text-text-mute">{insight.metric}</span>}
        <p className="text-sm text-text">→ {insight.recommendation}</p>
      </div>
    </div>
  )
}

export function InsightsCard({
  view,
  accountId,
  full = false,
}: {
  view:      InsightsView
  accountId: string | null
  full?:     boolean
}): ReactElement | null {
  const router = useRouter()
  const [toast, setToast]   = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const [isPending, startTransition] = useTransition()

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 4000)
  }

  function handleGenerate(refresh: boolean) {
    setNotConfigured(false)
    startTransition(async () => {
      const result = await generateInsights({ accountId, refresh })
      if (result.success) {
        showToast(result.data.cached ? INSIGHTS.CACHED : INSIGHTS.SUCCESS, "success")
        router.refresh()
      } else if (result.error === "AI_NOT_CONFIGURED") {
        setNotConfigured(true)
      } else {
        const msg = result.error in INSIGHTS.ERRORS
          ? INSIGHTS.ERRORS[result.error as keyof typeof INSIGHTS.ERRORS]
          : INSIGHTS.ERRORS.DEFAULT
        showToast(msg, "error")
      }
    })
  }

  // Compact (dashboard) hides itself when there's nothing meaningful to show.
  if (!full && view.status === "insufficient") return null

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex w-4.5 shrink-0" style={{ color: "var(--color-accent)" }}><SparklesIcon /></span>
        <span className="text-md font-semibold text-text">{INSIGHTS.CARD_TITLE}</span>
        {view.generatedAt && (
          <span className="mono text-xs text-text-mute shrink-0">
            {view.tradesCount} {INSIGHTS.ANALYZED}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!full && view.status === "ready" && (
          <Link href={`${APP_URLS.INSIGHTS}${accountId ? `?account=${accountId}` : ""}`}
            className="text-xs text-text-mute hover:text-text-dim transition-colors">
            {INSIGHTS.VIEW_ALL} →
          </Link>
        )}
        {view.status === "ready" && (
          <Button variant={view.stale ? "accent" : "ghost"} loading={isPending}
            onClick={() => handleGenerate(true)}>
            {isPending ? INSIGHTS.ANALYZING : INSIGHTS.REFRESH}
          </Button>
        )}
      </div>
    </div>
  )

  const body = ((): ReactElement => {
    if (notConfigured) {
      return (
        <div className="text-sm">
          <div className="font-semibold text-text mb-1">{INSIGHTS.NOT_CONFIGURED.TITLE}</div>
          <div className="text-text-mute">{INSIGHTS.NOT_CONFIGURED.MESSAGE}</div>
        </div>
      )
    }

    if (view.status === "insufficient") {
      return (
        <div className="text-sm">
          <div className="font-semibold text-text mb-1">{INSIGHTS.INSUFFICIENT.TITLE}</div>
          <div className="text-text-mute">{INSIGHTS.INSUFFICIENT.MESSAGE}</div>
        </div>
      )
    }

    if (view.status === "empty" || view.insights.length === 0) {
      return (
        <div className="flex flex-col items-start gap-3">
          <div className="text-sm">
            <div className="font-semibold text-text mb-1">{INSIGHTS.EMPTY.TITLE}</div>
            <div className="text-text-mute">{INSIGHTS.EMPTY.MESSAGE}</div>
          </div>
          <Button variant="accent" loading={isPending} onClick={() => handleGenerate(false)}>
            {isPending ? INSIGHTS.ANALYZING : INSIGHTS.GENERATE}
          </Button>
        </div>
      )
    }

    const items = full ? view.insights : view.insights.slice(0, COMPACT_LIMIT)

    if (full) {
      return (
        <div className="flex flex-col gap-4">
          {view.stale && (
            <div className="text-sm text-amber-500" style={{ color: "#f59e0b" }}>{INSIGHTS.STALE}</div>
          )}
          {CATEGORY_ORDER.filter(c => items.some(i => i.category === c)).map(cat => (
            <div key={cat} className="flex flex-col gap-2">
              <span className="label-caps">{INSIGHTS.CATEGORY[cat]}</span>
              {items.filter(i => i.category === cat).map((insight, idx) => (
                <InsightItem key={`${cat}-${idx}`} insight={insight} />
              ))}
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        {view.stale && (
          <div className="text-sm" style={{ color: "#f59e0b" }}>{INSIGHTS.STALE}</div>
        )}
        {items.map((insight, idx) => <InsightItem key={idx} insight={insight} />)}
      </div>
    )
  })()

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}
      <div className="card p-4 flex flex-col gap-3">
        {header}
        {body}
      </div>
    </>
  )
}
