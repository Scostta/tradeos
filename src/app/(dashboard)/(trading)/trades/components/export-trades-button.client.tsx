"use client"

import { useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import type { ReactElement } from "react"
import { exportTradesCsv } from "~/actions/trades"
import { TRADES } from "~/constants/copies/trades"
import { Toast } from "~/lib/ui/toast"

/** Downloads every trade matching the active filters as a CSV. */
export function ExportTradesButton(): ReactElement {
  const searchParams       = useSearchParams()
  const [error, setError]  = useState(false)
  const [isPending, start] = useTransition()

  function handleExport() {
    setError(false)
    start(async () => {
      const params = Object.fromEntries(searchParams.entries())
      const result = await exportTradesCsv(params)
      if (!result.success) {
        setError(true)
        setTimeout(() => setError(false), 4000)
        return
      }
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = result.data.filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant="error" message={TRADES.LIST.EXPORT_ERROR} />
        </div>
      )}
      <button
        type="button"
        onClick={handleExport}
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 h-8 rounded-sm text-base text-text-dim border border-border hover:border-border-hi transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {isPending ? TRADES.LIST.EXPORTING : TRADES.LIST.EXPORT}
      </button>
    </>
  )
}
