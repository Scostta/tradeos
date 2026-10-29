"use client"

import type { ReactElement } from "react"
import { createPortal } from "react-dom"
import { MONEY } from "~/constants/copies/money"
import { useSidebarSlot } from "~/hooks/use-sidebar-slot"
import { fmtDay } from "./money-format"

// §5: pie del sidebar de Money con la cuenta por defecto y hasta qué fecha
// llega lo importado. Se pinta en el hueco del shell con un portal.
export function MoneySidebarFooter({ account, importedThrough }: {
  account:         string | null      // "imagin ES•• 7988"
  importedThrough: string | null      // YYYY-MM-DD
}): ReactElement | null {
  const slot = useSidebarSlot()
  if (!slot || (!account && !importedThrough)) return null
  return createPortal(
    <div className="mx-2 mb-1 flex flex-col gap-0.5">
      {account && <span className="text-sm text-text-dim truncate">{account}</span>}
      {importedThrough && (
        <span className="mono text-xs text-text-mute">
          {MONEY.NAV.IMPORTED_THROUGH.replace("{date}", fmtDay(importedThrough, { year: true }))}
        </span>
      )}
    </div>,
    slot,
  )
}
