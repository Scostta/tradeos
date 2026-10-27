"use client"

import { useEffect } from "react"
import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import { COMMON } from "~/constants/copies/common"
import { cn } from "~/utils/cn"
import { ACTIVE_MODULE_STORAGE_KEY, APP_MODULES, MODULE_HOME } from "~/helpers/active-module"
import type { AppModule } from "~/helpers/active-module"

const LABELS: Record<AppModule, string> = {
  trading: COMMON.MODULES.TRADING,
  invest:  COMMON.MODULES.INVEST,
  money:   COMMON.MODULES.MONEY,
}

function remember(module: AppModule): void {
  try {
    window.localStorage.setItem(ACTIVE_MODULE_STORAGE_KEY, module)
  } catch {
    // Sin storage (modo privado): "/" irá al home de Trading.
  }
}

// Control segmentado bajo la marca. En móvil vive dentro del drawer del
// sidebar, así que es el mismo componente.
export function ModuleSwitcher({ active, onNavigate }: {
  active:      AppModule
  onNavigate?: () => void
}): ReactElement {
  const router = useRouter()

  // El último módulo visitado (por cualquier vía, no solo el conmutador).
  useEffect(() => { remember(active) }, [active])

  function select(module: AppModule) {
    if (module === active) return
    remember(module)
    onNavigate?.()
    router.push(MODULE_HOME[module])
  }

  return (
    <div
      role="tablist"
      aria-label={COMMON.MODULE_SWITCHER}
      className="grid grid-cols-3 gap-0.5 p-0.5 mx-1 rounded-md bg-bg border border-border"
    >
      {APP_MODULES.map(module => {
        const isActive = module === active
        return (
          <button
            key={module}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => select(module)}
            className={cn(
              "py-1.5 rounded-sm text-sm transition-colors cursor-pointer",
              isActive
                ? "bg-surface-2 text-text font-semibold"
                : "text-text-mute hover:text-text-dim",
            )}
          >
            {LABELS[module]}
          </button>
        )
      })}
    </div>
  )
}
