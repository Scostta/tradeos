import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import { getFinanceSettings } from "~/services/queries/finance"
import { MoneyOnboarding } from "./components/money-onboarding.client"

// §5.1 Overview. El contenido llega en el paso 6; de momento, alta de Money.
export default async function MoneyPage(): Promise<ReactElement> {
  const settingsResult = await getFinanceSettings()
  const settings = settingsResult.success ? settingsResult.data : null

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{MONEY.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{MONEY.SUBTITLE}</div>
        </div>
      </header>
      {!settingsResult.success ? (
        <div className="page-pad">
          <div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div>
        </div>
      ) : !settings ? (
        <MoneyOnboarding />
      ) : null}
    </div>
  )
}
