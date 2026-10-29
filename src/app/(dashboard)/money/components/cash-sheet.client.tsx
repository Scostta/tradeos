"use client"

import { createContext, useContext, useState } from "react"
import type { ReactElement, ReactNode } from "react"
import { Toaster } from "~/lib/ui/toaster.client"
import type { FinanceCategory } from "~/types/finance"
import { CashForm } from "./cash-form.client"

/** Fecha local del dispositivo (el gasto es de "hoy" para quien lo apunta). */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const CashSheetContext = createContext<(() => void) | null>(null)

/** Abre el alta de efectivo; null fuera de Money o antes del alta de Money. */
export function useOpenCashSheet(): (() => void) | null {
  return useContext(CashSheetContext)
}

// §5.7 M2 sobre la página actual: hoja inferior en móvil (el "+" de la barra)
// y modal centrado en escritorio (botón de la cabecera).
export function CashSheetProvider({ categories, usage, children }: {
  categories: FinanceCategory[]
  usage:      string[]
  children:   ReactNode
}): ReactElement {
  const [sheet, setSheet] = useState<string | null>(null)   // fecha de hoy al abrir; null = cerrada
  const [toast, setToast] = useState<string | null>(null)

  function saved(message: string) {
    setSheet(null)
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <CashSheetContext.Provider value={() => setSheet(localToday())}>
      {children}
      {sheet && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSheet(null)}
        >
          <div
            className="card w-full md:max-w-110 p-5 border-border-hi mb-4 md:mb-0"
            onClick={e => e.stopPropagation()} style={{ boxShadow: "0 20px 80px rgba(0,0,0,.6)" }}
          >
            <CashForm categories={categories} usage={usage} today={sheet} onClose={() => setSheet(null)} onSaved={saved} />
          </div>
        </div>
      )}
      {toast && <Toaster variant="success" message={toast} />}
    </CashSheetContext.Provider>
  )
}
