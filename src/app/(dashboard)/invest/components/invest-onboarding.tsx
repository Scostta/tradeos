import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { SettingsForm } from "./settings-form.client"

// §4.1: sin invest_settings no se puede hacer nada más hasta rellenarlos.
export function InvestOnboarding(): ReactElement {
  return (
    <div className="flex-1 min-h-0 overflow-auto page-pad">
      <div className="card p-6 flex flex-col gap-5 mx-auto" style={{ maxWidth: 560 }}>
        <div>
          <h2 className="text-lg font-semibold text-text">{INVEST.SETTINGS.ONBOARDING_TITLE}</h2>
          <p className="text-md text-text-dim mt-1">{INVEST.SETTINGS.ONBOARDING_BODY}</p>
        </div>
        <SettingsForm settings={null} />
      </div>
    </div>
  )
}
