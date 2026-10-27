import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { getInvestSettings } from "~/services/queries/invest"
import { ScreenTab } from "./components/screen-tab"
import { SettingsButton } from "./components/settings-button.client"
import { InvestOnboarding } from "./components/invest-onboarding"

export default async function InvestPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}): Promise<ReactElement> {
  const params = await searchParams
  const query = params.q?.trim().toUpperCase() || null

  const settingsResult = await getInvestSettings()
  const settings = settingsResult.success ? settingsResult.data : null

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{INVEST.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{INVEST.SUBTITLE}</div>
        </div>
        {settings && (
          <div className="ml-auto">
            <SettingsButton settings={settings} />
          </div>
        )}
      </header>

      {!settingsResult.success ? (
        <div className="page-pad">
          <div className="card p-4 text-sm text-loss">{INVEST.SCREEN.LOAD_ERROR}</div>
        </div>
      ) : !settings ? (
        <InvestOnboarding />
      ) : (
        <>
          {/* El scroll va en un bloque normal: en un flex-col, las tarjetas con
              overflow-hidden se encogían en vez de desbordar. */}
          <div className="flex-1 min-h-0 overflow-auto page-pad">
            <div className="flex flex-col gap-4">
              <ScreenTab query={query} settings={settings} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
