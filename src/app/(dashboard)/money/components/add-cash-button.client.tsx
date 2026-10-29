"use client"

import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import { PlusIcon } from "~/lib/ui/icons/plus-icon"
import { useOpenCashSheet } from "./cash-sheet.client"

// Alta de efectivo en escritorio (en móvil la abre el "+" de la barra inferior).
export function AddCashButton(): ReactElement | null {
  const openCash = useOpenCashSheet()
  if (!openCash) return null
  return (
    <button type="button" onClick={openCash} className="btn-ghost hidden md:inline-flex items-center gap-1.5 shrink-0">
      <PlusIcon className="size-3.5" />{MONEY.CASH.BUTTON}
    </button>
  )
}
