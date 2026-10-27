import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"

export default function MoneyPage(): ReactElement {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{MONEY.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{MONEY.SUBTITLE}</div>
        </div>
      </header>
    </div>
  )
}
