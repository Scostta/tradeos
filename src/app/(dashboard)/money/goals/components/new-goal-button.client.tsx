"use client"

import { useState } from "react"
import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import type { MonthKey } from "~/lib/finance/dates"
import { NewGoalModal } from "./new-goal-modal.client"

// Botón "New goal" de la cabecera; abre el formulario en un modal.
export function NewGoalButton({ free, openMonth }: { free: number; openMonth: MonthKey }): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-accent ml-auto">{MONEY.GOALS.NEW}</button>
      {open && <NewGoalModal free={free} openMonth={openMonth} onClose={() => setOpen(false)} />}
    </>
  )
}
