import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"

export default function InvestPositionsPage(): ReactElement {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <h1 className="text-xl font-semibold tracking-tight text-text">{INVEST.POSITIONS.TITLE}</h1>
      </header>
    </div>
  )
}
