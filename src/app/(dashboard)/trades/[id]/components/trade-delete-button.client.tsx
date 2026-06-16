"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { deleteTrade } from "~/actions/trades"
import { APP_URLS } from "~/constants/app-urls"

export function TradeDeleteButton({ tradeId }: { tradeId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteTrade({ id: tradeId })
      if (result.success) {
        router.push(APP_URLS.TRADES)
        router.refresh()
      } else {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-sm text-text-dim">Delete trade?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-3 h-7.5 rounded-sm text-base text-bg bg-loss hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isPending ? "Deleting…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="px-3 h-7.5 rounded-sm text-base text-text-dim border border-border hover:border-border-hi transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={error ?? "Delete this trade"}
      className="flex items-center gap-1.5 px-3 h-7.5 rounded-sm text-base text-text-dim border border-border hover:border-loss hover:text-loss transition-colors whitespace-nowrap"
    >
      Delete
    </button>
  )
}
