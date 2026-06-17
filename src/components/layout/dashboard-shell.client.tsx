"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Sidebar } from "./sidebar.client"
import { TimezoneContext } from "~/hooks/use-timezone"

export function DashboardShell({
  userEmail,
  userName,
  timezone = "UTC",
  children,
}: {
  userEmail?: string
  userName?: string
  timezone?: string
  children: ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <TimezoneContext.Provider value={timezone}>
    <div className="flex h-screen overflow-hidden bg-bg">
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
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="ml-3 font-semibold text-text tracking-tight">TradeOS</span>
        </div>
        {children}
      </main>
    </div>
    </TimezoneContext.Provider>
  )
}
