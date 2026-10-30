import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { TRADING_SETTINGS } from "~/constants/copies/trading-settings"
import { getProfile } from "~/services/queries/profile"
import { getApiTokens } from "~/services/queries/api-tokens"
import { cn } from "~/utils/cn"
import { NinjaTraderSyncCard } from "./components/ninjatrader-sync-card.client"
import { BreakEvenCard } from "./components/break-even-card.client"

const S = TRADING_SETTINGS

const TABS = ["ninjatrader", "break-even"] as const
type Tab = (typeof TABS)[number]

// /trading/settings: ajustes del módulo Trading, una pestaña por ?tab= (como
// /money/settings). Lo general de la app (perfil, contraseña, avisos, borrar
// la cuenta) sigue en /settings.
export default async function TradingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}): Promise<ReactElement> {
  const params = await searchParams
  const tab: Tab = TABS.find(t => t === params.tab) ?? TABS[0]

  const [profileResult, tokensResult] = await Promise.all([getProfile(), getApiTokens()])
  const timeZone = profileResult.success ? profileResult.data.timezone : "UTC"

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-text">{S.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5 truncate">{S.SUBTITLE}</div>
        </div>
      </header>

      <div className="flex items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
        <div className="inline-flex items-center rounded-md border border-border overflow-x-auto max-w-full">
          {TABS.map((t, i) => (
            <Link
              key={t} href={`${APP_URLS.TRADING_SETTINGS}?tab=${t}`}
              className={cn(
                "px-3 py-1.5 text-sm whitespace-nowrap border-t",
                i > 0 && "border-l border-l-border",
                tab === t ? "bg-surface-2 text-text border-t-accent" : "text-text-mute border-t-transparent hover:text-text-dim",
              )}
            >
              {S.TABS[t]}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto page-pad">
        {tab === "ninjatrader" && (tokensResult.success
          ? <NinjaTraderSyncCard tokens={tokensResult.data} timeZone={timeZone} />
          : <div className="card p-4 text-sm text-loss">{S.ERRORS.DEFAULT}</div>)}
        {tab === "break-even" && (profileResult.success
          ? <BreakEvenCard points={profileResult.data.beThresholdPoints} />
          : <div className="card p-4 text-sm text-loss">{S.ERRORS.DEFAULT}</div>)}
      </div>
    </div>
  )
}
