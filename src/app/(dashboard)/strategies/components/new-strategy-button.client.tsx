"use client"

import type { ReactElement } from "react"
import { STRATEGIES } from "~/constants/copies/strategies"
import { StrategyEditor } from "./strategy-editor.client"

type Props = { label?: string; className?: string }

export function NewStrategyButton({ label, className = "btn-accent" }: Props): ReactElement {
  return (
    <StrategyEditor
      mode="create"
      renderTrigger={(open) => (
        <button type="button" onClick={open} className={className}>
          {label ?? STRATEGIES.EDITOR.CREATE_TITLE}
        </button>
      )}
    />
  )
}
