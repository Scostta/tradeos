"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Sidebar } from "./sidebar.client"
import { PropFirmAlertBanner } from "./prop-firm-alert-banner.client"
import { TimezoneContext } from "~/hooks/use-timezone"
import { COMMON } from "~/constants/copies/common"
import type { PropFirmAlertItem } from "~/types/prop-firm"

export function DashboardShell({
  userEmail,
  userName,
  timezone = "UTC",
  propFirmAlerts = [],
  children,
}: {
  userEmail?: string
  userName?: string
  timezone?: string
  propFirmAlerts?: PropFirmAlertItem[]
  children: ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <div className="flex items-center h-11 px-4 border-b border-border bg-bg md:hidden shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded text-text-mute hover:text-text transition-colors"
            aria-label={COMMON.OPEN_MENU}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="ml-3 font-semibold text-text tracking-tight">TradeOS</span>
        </div>
        <PropFirmAlertBanner alerts={propFirmAlerts} />
        {/* Wrapper so each page's `h-full` measures the space LEFT below the
            mobile topbar + alert banner — without it the page is as tall as
            <main> and its bottom is clipped by overflow-hidden on mobile. */}
        <div className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>
      </main>
    </div>
    </TimezoneContext.Provider>
  )
}
