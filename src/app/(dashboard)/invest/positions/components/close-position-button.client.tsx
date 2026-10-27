"use client"

import { useState } from "react"
import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { Toast } from "~/lib/ui/toast"
import { cn } from "~/utils/cn"
import { ClosePositionModal } from "./close-position-modal.client"
import type { ClosablePosition } from "./close-position-modal.client"

export function ClosePositionButton({ position }: { position: ClosablePosition }): ReactElement {
  const [open, setOpen] = useState(false)
  const [closed, setClosed] = useState(false)

  function handleClosed() {
    setOpen(false)
    setClosed(true)
    setTimeout(() => setClosed(false), 4000)
  }

  return (
    <>
      {closed && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant="success" message={INVEST.CLOSE.CLOSED.replace("{ticker}", position.ticker)} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "btn-ghost px-3 py-1 text-xs",
          position.sellSignal ? "border-loss/50 text-loss hover:border-loss" : "text-text hover:border-border-hi",
        )}
      >
        {INVEST.POSITIONS.CLOSE_CTA}
      </button>
      {open && (
        <ClosePositionModal position={position} onClose={() => setOpen(false)} onClosed={handleClosed} />
      )}
    </>
  )
}
