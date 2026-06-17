"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"
import { XIcon } from "~/lib/ui/icons/x-icon"

/** Clears every trade filter, keeping only the active account. */
export function ClearFiltersButton(): ReactElement {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  function clear() {
    const params  = new URLSearchParams()
    const account = searchParams.get("account")
    if (account) params.set("account", account)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <button
      type="button"
      onClick={clear}
      className="inline-flex items-center gap-1.5 h-7.5 px-2.5 rounded-md text-xs text-text-mute hover:text-loss transition-colors cursor-pointer"
    >
      <XIcon />
      {TRADES.LIST.FILTERS.CLEAR_ALL}
    </button>
  )
}
