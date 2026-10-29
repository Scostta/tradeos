"use client"

import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import { COMMON } from "~/constants/copies/common"
import { cn } from "~/utils/cn"
import { APP_MODULES, MODULE_HOME, rememberModule } from "~/helpers/active-module"
import type { AppModule } from "~/helpers/active-module"

const LABELS: Record<AppModule, string> = {
  trading: COMMON.MODULES.TRADING,
  invest:  COMMON.MODULES.INVEST,
  money:   COMMON.MODULES.MONEY,
}

// Control segmentado bajo la marca. En móvil vive dentro del drawer del
// sidebar, así que es el mismo componente. `flagged`: módulos con un aviso
// pendiente (punto si no es el activo).
export function ModuleSwitcher({ active, flagged, onNavigate }: {
  active:      AppModule
  flagged:     Set<AppModule>
  onNavigate?: () => void
}): ReactElement {
  const router = useRouter()

  // El último módulo visitado por cualquier vía lo guarda useActiveModule;
  // aquí se adelanta para que la navegación ya lo lleve.
  function select(module: AppModule) {
    if (module === active) return
    rememberModule(module)
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
              "relative py-1.5 rounded-sm text-sm transition-colors cursor-pointer",
              isActive
                ? "bg-surface-2 text-text font-semibold"
                : "text-text-mute hover:text-text-dim",
            )}
          >
            {LABELS[module]}
            {!isActive && flagged.has(module) && (
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-accent" aria-hidden />
            )}
          </button>
        )
      })}
    </div>
  )
}
