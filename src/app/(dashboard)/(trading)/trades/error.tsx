"use client"

import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"

export default function TradesError({ reset }: { reset: () => void }): ReactElement {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-4">
      <div className="text-md font-semibold text-text">{TRADES.LIST.TITLE}</div>
      <div className="text-sm text-text-mute">Failed to load trades. Please try again.</div>
      <button onClick={reset} className="btn-accent">
        Try again
      </button>
    </div>
  )
}
