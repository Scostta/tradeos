"use client"

import { useState } from "react"
import type { ComponentType, ReactElement, SVGProps } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { APP_URLS } from "~/constants/app-urls"
import { COMMON } from "~/constants/copies/common"
import { MONEY } from "~/constants/copies/money"
import { CoinsIcon } from "~/lib/ui/icons/coins-icon"
import { ListIcon } from "~/lib/ui/icons/list-icon"
import { PlusIcon } from "~/lib/ui/icons/plus-icon"
import { RepeatIcon } from "~/lib/ui/icons/repeat-icon"
import { TargetIcon } from "~/lib/ui/icons/target-icon"
import { Toaster } from "~/lib/ui/toaster.client"
import type { FinanceCategory } from "~/types/finance"
import { cn } from "~/utils/cn"
import { CashForm } from "./cash-form.client"

type Item = { href: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; exact?: boolean }

const LEFT: Item[] = [
  { href: APP_URLS.MONEY, label: COMMON.NAV_LABELS.OVERVIEW, Icon: CoinsIcon, exact: true },
  { href: APP_URLS.MONEY_TRANSACTIONS, label: COMMON.NAV_LABELS.TRANSACTIONS, Icon: ListIcon },
]
const RIGHT: Item[] = [
  { href: APP_URLS.MONEY_SUBSCRIPTIONS, label: COMMON.NAV_LABELS.SUBSCRIPTIONS, Icon: RepeatIcon },
  { href: APP_URLS.MONEY_GOALS, label: COMMON.NAV_LABELS.GOALS, Icon: TargetIcon },
]

/** Fecha local del dispositivo (el gasto es de "hoy" para quien lo apunta). */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// §5.7 M1: barra inferior de Money, solo a ancho de móvil. El "+" abre el alta
// de efectivo (M2) como hoja sobre la página actual.
export function MoneyBottomBar({ categories, usage }: { categories: FinanceCategory[]; usage: string[] }): ReactElement {
  const pathname = usePathname()
  const [sheet, setSheet] = useState<string | null>(null)   // fecha de hoy al abrir; null = cerrada
  const [toast, setToast] = useState<string | null>(null)

  function saved(message: string) {
    setSheet(null)
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const link = ({ href, label, Icon, exact }: Item) => {
    const on = exact ? pathname === href : pathname.startsWith(href)
    return (
      <Link key={href} href={href} className={cn("flex-1 flex flex-col items-center gap-0.5 py-1.5 text-xs", on ? "text-accent" : "text-text-mute")}>
        <Icon width={18} height={18} />
        <span className="truncate max-w-full">{label}</span>
      </Link>
    )
  }

  return (
    <>
      <nav className="md:hidden shrink-0 flex items-center border-t border-border bg-bg px-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {LEFT.map(link)}
        <div className="flex-1 flex justify-center">
          <button
            type="button" onClick={() => setSheet(localToday())} aria-label={MONEY.CASH.ADD}
            className="size-11 -mt-4 rounded-full bg-accent text-bg flex items-center justify-center"
            style={{ boxShadow: "0 0 16px var(--accent-glow)" }}
          >
            <PlusIcon className="size-5" />
          </button>
        </div>
        {RIGHT.map(link)}
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm p-4" onClick={() => setSheet(null)}>
          <div className="card w-full p-5 border-border-hi mb-4" onClick={e => e.stopPropagation()} style={{ boxShadow: "0 20px 80px rgba(0,0,0,.6)" }}>
            <CashForm categories={categories} usage={usage} today={sheet} onClose={() => setSheet(null)} onSaved={saved} />
          </div>
        </div>
      )}
      {toast && <Toaster variant="success" message={toast} />}
    </>
  )
}
