"use client"

import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"

type StopPriceCtx = {
  stopPrice:    number | null
  setStopPrice: (p: number | null) => void
}

const StopPriceContext = createContext<StopPriceCtx>({
  stopPrice:    null,
  setStopPrice: () => {},
})

export function StopPriceProvider({
  children,
  initial,
}: {
  children: ReactNode
  initial:  number | null
}) {
  const [stopPrice, setStopPrice] = useState<number | null>(initial)
  return (
    <StopPriceContext.Provider value={{ stopPrice, setStopPrice }}>
      {children}
    </StopPriceContext.Provider>
  )
}

export function useStopPrice() {
  return useContext(StopPriceContext)
}
