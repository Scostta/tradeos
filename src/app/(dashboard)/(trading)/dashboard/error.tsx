"use client"

import { DASHBOARD } from "~/constants/copies/dashboard"

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-4">
      <div className="text-md font-semibold text-text">{DASHBOARD.ERROR.TITLE}</div>
      <div className="text-sm text-text-mute">{DASHBOARD.ERROR.MESSAGE}</div>
      <button onClick={reset} className="btn-accent">
        {DASHBOARD.ERROR.RETRY}
      </button>
    </div>
  )
}
