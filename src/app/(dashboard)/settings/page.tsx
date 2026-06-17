import type { ReactElement } from "react"
import { createClient } from "~/utils/supabase/server"
import { getProfile } from "~/services/queries/profile"
import { SETTINGS } from "~/constants/copies/settings"
import { PreferencesCard } from "./components/preferences-card.client"
import { SecurityCard } from "./components/security-card.client"
import { DangerZoneCard } from "./components/danger-zone-card.client"

export default async function SettingsPage(): Promise<ReactElement> {
  const supabase = await createClient()
  const [profileResult, { data: { user } }] = await Promise.all([
    getProfile(),
    supabase.auth.getUser(),
  ])

  const email = user?.email ?? ""

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{SETTINGS.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{SETTINGS.PAGE_SUBTITLE}</div>
        </div>
      </header>

      <div className="flex-1 overflow-auto page-pad">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {profileResult.success ? (
            <PreferencesCard profile={profileResult.data} />
          ) : (
            <div className="card p-4 text-sm text-loss">{SETTINGS.ERRORS.DEFAULT}</div>
          )}
          <SecurityCard email={email} />
          <div className="lg:col-span-2">
            <DangerZoneCard email={email} />
          </div>
        </div>
      </div>
    </div>
  )
}
