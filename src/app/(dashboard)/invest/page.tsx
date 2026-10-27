import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { InvestTabs } from "./components/invest-tabs"
import type { InvestTab } from "./components/invest-tabs"
import { ScreenTab } from "./components/screen-tab"

export default async function InvestPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>
}): Promise<ReactElement> {
  const params = await searchParams
  const tab: InvestTab = "screen"
  const query = params.q?.trim().toUpperCase() || null

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{INVEST.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{INVEST.SUBTITLE}</div>
        </div>
      </header>

      <InvestTabs active={tab} />

      <div className="flex-1 overflow-auto page-pad flex flex-col gap-4">
        {tab === "screen" && <ScreenTab query={query} />}
      </div>
    </div>
  )
}
