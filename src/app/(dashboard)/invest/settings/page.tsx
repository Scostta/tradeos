import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { getInvestSettings } from "~/services/queries/invest"
import { SettingsForm } from "../components/settings-form.client"
import { InvestOnboarding } from "../components/invest-onboarding"

const S = INVEST.SETTINGS

// /invest/settings: patrimonio, benchmark y "Start real test" (§4, §1.6).
// Sin invest_settings, el alta como en el resto de Invest.
export default async function InvestSettingsPage(): Promise<ReactElement> {
  const settingsResult = await getInvestSettings()
  const settings = settingsResult.success ? settingsResult.data : null

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{S.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{S.SUBTITLE}</div>
        </div>
      </header>

      {!settingsResult.success ? (
        <div className="page-pad">
          <div className="card p-4 text-sm text-loss">{INVEST.SCREEN.LOAD_ERROR}</div>
        </div>
      ) : !settings ? (
        <InvestOnboarding />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto page-pad">
          <section className="card p-5">
            <SettingsForm settings={settings} />
          </section>
        </div>
      )}
    </div>
  )
}
