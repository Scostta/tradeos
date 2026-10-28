"use client"

import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"
import type { ThesisAnswers } from "~/types/invest"

// Respuestas de "Thesis prompts" compartidas con el botón Open de la cabecera,
// para que el modal se precargue con lo escrito aunque no se haya guardado aún.
type ThesisDraftCtx = {
  answers:    ThesisAnswers | null
  setAnswers: (a: ThesisAnswers) => void
}

const ThesisDraftContext = createContext<ThesisDraftCtx>({
  answers:    null,
  setAnswers: () => {},
})

export function ThesisDraftProvider({
  children,
  initial,
}: {
  children: ReactNode
  initial:  ThesisAnswers
}) {
  const [answers, setAnswers] = useState<ThesisAnswers>(initial)
  return (
    <ThesisDraftContext.Provider value={{ answers, setAnswers }}>
      {children}
    </ThesisDraftContext.Provider>
  )
}

export function useThesisDraft() {
  return useContext(ThesisDraftContext)
}
