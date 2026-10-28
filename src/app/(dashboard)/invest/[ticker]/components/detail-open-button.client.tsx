"use client"

import type { ReactElement } from "react"
import { OpenPositionButton } from "../../components/open-position-button.client"
import type { OpenAction } from "../../components/open-action"
import { useThesisDraft } from "./thesis-draft-context.client"

// El botón de Screen, con el borrador vivo de "Thesis prompts" de esta página.
export function DetailOpenButton({ action }: { action: OpenAction }): ReactElement {
  const { answers } = useThesisDraft()
  return (
    <OpenPositionButton
      candidate={{ ...action.candidate, draft: answers ?? action.candidate.draft }}
      blockers={action.blockers}
      variant="primary"
    />
  )
}
