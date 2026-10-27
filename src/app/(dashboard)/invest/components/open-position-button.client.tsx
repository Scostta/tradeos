"use client"

import { useState } from "react"
import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { Toast } from "~/lib/ui/toast"
import type { OpenBlocker } from "~/lib/calculations/invest-run"
import { OpenPositionModal } from "./open-position-modal.client"
import type { OpenCandidate } from "./open-position-modal.client"

type Props = {
  candidate: OpenCandidate
  blockers:  OpenBlocker[]
}

// Deshabilitado con el motivo en el tooltip; el servidor vuelve a validarlo todo.
export function OpenPositionButton({ candidate, blockers }: Props): ReactElement {
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  const reason = blockers.map(b => INVEST.BLOCKERS[b]).join(" ")
  const disabled = blockers.length > 0

  function handleOpened() {
    setOpen(false)
    setOpened(true)
    setTimeout(() => setOpened(false), 4000)
  }

  return (
    <>
      {opened && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant="success" message={(candidate.paper ? INVEST.OPEN.OPENED_PAPER : INVEST.OPEN.OPENED).replace("{ticker}", candidate.ticker)} />
        </div>
      )}
      <span title={disabled ? reason : undefined} className="inline-flex">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="btn-ghost inline-flex items-center px-3 py-1 text-xs text-text hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-text"
        >
          {INVEST.OPEN.CTA}
        </button>
      </span>
      {open && <OpenPositionModal candidate={candidate} onClose={() => setOpen(false)} onOpened={handleOpened} />}
    </>
  )
}
