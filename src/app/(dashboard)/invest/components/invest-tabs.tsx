import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import { cn } from "~/utils/cn"

export type InvestTab = "screen"

const TABS: { id: InvestTab; label: string }[] = [
  { id: "screen", label: INVEST.TABS.SCREEN },
]

export function InvestTabs({ active }: { active: InvestTab }): ReactElement {
  return (
    <nav className="flex items-center gap-1 px-4 py-2.5 border-b border-border shrink-0 overflow-x-auto">
      {TABS.map(t => (
        <Link
          key={t.id}
          href={`${APP_URLS.INVEST}?tab=${t.id}`}
          className={cn(
            "inline-flex items-center px-3 py-1.5 rounded-md text-md whitespace-nowrap shrink-0 transition-colors",
            t.id === active
              ? "bg-surface-2 text-text font-semibold"
              : "text-text-mute font-medium hover:text-text",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
