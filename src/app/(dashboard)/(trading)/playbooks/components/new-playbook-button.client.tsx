"use client"

import type { ReactElement } from "react"
import { PLAYBOOKS } from "~/constants/copies/playbooks"
import { PlaybookEditor } from "./playbook-editor.client"

type Props = { label?: string; className?: string }

export function NewPlaybookButton({ label, className = "btn-accent" }: Props): ReactElement {
  return (
    <PlaybookEditor
      mode="create"
      renderTrigger={(open) => (
        <button type="button" onClick={open} className={className}>
          {label ?? PLAYBOOKS.EDITOR.CREATE_TITLE}
        </button>
      )}
    />
  )
}
