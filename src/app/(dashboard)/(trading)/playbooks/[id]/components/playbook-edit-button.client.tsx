"use client"

import type { ReactElement } from "react"
import { PlaybookEditor } from "../../components/playbook-editor.client"
import { PLAYBOOKS } from "~/constants/copies/playbooks"
import type { PlaybookWithStats } from "~/types/playbook"

export function PlaybookEditButton({ playbook }: { playbook: PlaybookWithStats }): ReactElement {
  return (
    <PlaybookEditor
      mode="edit"
      playbook={playbook}
      renderTrigger={(open) => (
        <button
          onClick={open}
          className="flex items-center gap-1.5 px-3 h-7.5 rounded-sm text-base text-text-dim border border-border hover:border-border-hi transition-colors whitespace-nowrap cursor-pointer"
        >
          {PLAYBOOKS.DETAIL.EDIT}
        </button>
      )}
    />
  )
}
