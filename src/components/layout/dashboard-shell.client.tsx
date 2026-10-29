"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Sidebar } from "./sidebar.client"
import { TimezoneContext } from "~/hooks/use-timezone"
import { useActiveModule } from "~/hooks/use-active-module"
import { COMMON } from "~/constants/copies/common"
import type { AppModule } from "~/helpers/active-module"
import { modulesWithBadge } from "./sidebar-badges"
import type { SidebarBadges } from "./sidebar-badges"

export function DashboardShell({
  userEmail,
  userName,
  timezone = "UTC",
  initialModule,
  badges,
  children,
}: {
  userEmail?: string
  userName?: string
  timezone?: string
  initialModule: AppModule   // cookie active_module, para las rutas compartidas
  badges: SidebarBadges
  children: ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Las alertas de prop firm y el selector de cuenta son de Trading: viven en
  // el layout de (trading) y en las cabeceras de sus páginas.
  const activeModule = useActiveModule(initialModule)

  return (
    <TimezoneContext.Provider value={timezone}>
    {/* h-dvh (dynamic viewport) instead of h-screen: on mobile, 100vh sits
        behind the browser chrome and cuts off the bottom of every page. */}
    <div className="flex h-dvh overflow-hidden bg-bg">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        userEmail={userEmail}
        userName={userName}
        activeModule={activeModule}
        badges={badges}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <div className="flex items-center h-11 px-4 border-b border-border bg-bg md:hidden shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="relative p-1.5 rounded text-text-mute hover:text-text transition-colors"
            aria-label={COMMON.OPEN_MENU}
          >
            {modulesWithBadge(badges).size > 0 && (
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-accent" aria-hidden />
            )}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="ml-3 font-semibold text-text tracking-tight">TradeOS</span>
        </div>
        {/* Wrapper so each page's `h-full` measures the space LEFT below the
            mobile topbar — without it the page is as tall as <main> and its
            bottom is clipped by overflow-hidden on mobile. The (trading)
            layout adds the prop firm banner inside it. */}
        <div className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>
      </main>
    </div>
    </TimezoneContext.Provider>
  )
}
