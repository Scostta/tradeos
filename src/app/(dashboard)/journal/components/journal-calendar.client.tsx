"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { ReactElement } from "react"
import type { JournalDay } from "~/types/journal"
import type { Account } from "~/types"
import { JOURNAL } from "~/constants/copies/journal"
import { formatCurrency } from "~/helpers/format"
import { cn } from "~/utils/cn"
import { AccountSelector } from "~/components/account-selector.client"
import { DayDrawer } from "./day-drawer.client"

const DOW_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

function moodColor(mood: number): string {
  return JOURNAL.MOODS.find(m => m.v === mood)?.color ?? "#6b7280"
}

type Props = {
  weeks:     (JournalDay | null)[][]
  monthNet:  number
  year:      number
  month:     number
  accountId: string | null
  accounts:  Account[]
}

export function JournalCalendar({
  weeks,
  monthNet,
  year,
  month,
  accountId,
  accounts,
}: Props): ReactElement {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const selectedDay = selectedDate
    ? (weeks.flat().find((d): d is JournalDay => d?.date === selectedDate) ?? null)
    : null

  const now          = new Date()
  const canGoForward = !(year === now.getFullYear() && month >= now.getMonth() + 1)
                       && !(year > now.getFullYear())

  const navigate = useCallback(
    (dy: number, dm: number) => {
      let ny = dy, nm = dm
      if (nm < 1)  { ny--; nm = 12 }
      if (nm > 12) { ny++; nm = 1  }
      const params = new URLSearchParams()
      params.set("year",  String(ny))
      params.set("month", String(nm))
      if (accountId) params.set("account", accountId)
      router.push(`/journal?${params.toString()}`)
      setSelectedDate(null)
    },
    [accountId, router]
  )

  const pnlColor =
    monthNet > 0
      ? "var(--color-profit)"
      : monthNet < 0
      ? "var(--color-loss)"
      : "var(--color-text-dim)"

  return (
    <>
      {/* TopBar */}
      <header className="flex flex-col md:flex-row md:items-center gap-3 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{JOURNAL.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">
            {MONTH_NAMES[month - 1]} {year}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:ml-auto">
          {/* Month net */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-mute">{JOURNAL.MONTH_NET}</span>
            <span className="mono text-lg font-semibold" style={{ color: pnlColor }}>
              {formatCurrency(monthNet, { decimals: 0 })}
            </span>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-1 pl-3 border-l border-border">
            <button
              className="icon-btn"
              onClick={() => navigate(year, month - 1)}
              aria-label="Previous month"
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              className={cn("icon-btn", !canGoForward && "opacity-30 cursor-not-allowed")}
              onClick={() => canGoForward && navigate(year, month + 1)}
              aria-label="Next month"
              aria-disabled={!canGoForward}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Account filter */}
          {accounts.length > 0 && (
            <AccountSelector accounts={accounts} value={accountId} />
          )}
        </div>
      </header>

      {/* Body — calendar takes full width; drawer overlays */}
      <div className="flex-1 overflow-hidden page-pad">
        <style>{`
          @media (max-width: 767px) {
            .jcal-grid { grid-template-columns: repeat(7, 1fr) !important; }
            .jcal-week-col { display: none !important; }
            .jcal-day-cell { min-height: 58px !important; }
          }
        `}</style>
        {/* Day-of-week header */}
        <div
          className="grid mb-2 jcal-grid"
          style={{ gridTemplateColumns: "repeat(7, 1fr) 88px", gap: 6 }}
        >
          {DOW_HEADERS.map((d) => (
            <div key={d} className="label-caps px-2">{d}</div>
          ))}
          <div className="label-caps text-center jcal-week-col">WEEK</div>
        </div>

        {/* Weeks grid */}
        <div className="flex flex-col gap-1.5 min-h-0" style={{ height: "calc(100% - 28px)", overflowY: "auto" }}>
          {weeks.map((week, wi) => {
            const wNet   = week.reduce((s, d) => s + (d?.net ?? 0), 0)
            const wCount = week.reduce((s, d) => s + (d?.tradeCount ?? 0), 0)
            return (
              <div
                key={wi}
                className="grid min-h-0 jcal-grid"
                style={{ gridTemplateColumns: "repeat(7, 1fr) 88px", gap: 6, flex: "1 1 0" }}
              >
                {week.map((day, di) => {
                  if (!day) {
                    return (
                      <div
                        key={di}
                        className="bg-bg border border-border rounded-sm opacity-40 jcal-day-cell"
                      />
                    )
                  }

                  const isSelected = selectedDate === day.date
                  const hasTrades  = day.tradeCount > 0

                  if (!hasTrades) {
                    return (
                      <div
                        key={di}
                        className={cn(
                          "card text-left p-2 flex flex-col gap-1.5 relative jcal-day-cell",
                          day.isWeekend && "opacity-55"
                        )}
                        style={{ minHeight: 92 }}
                      >
                        <span className="mono text-lg font-semibold text-text-mute">
                          {day.day}
                        </span>
                        <div className="flex-1" />
                        <div className="text-xxs text-text-mute">
                          {day.isWeekend ? "closed" : "—"}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <button
                      key={di}
                      onClick={() => setSelectedDate(isSelected ? null : day.date)}
                      className={cn(
                        "card text-left p-2 flex flex-col gap-1.5 relative transition-colors cursor-pointer jcal-day-cell",
                        isSelected  && "border-accent",
                        !isSelected && "hover:border-border-hi",
                        day.isWeekend && "opacity-55"
                      )}
                      style={{ minHeight: 92 }}
                    >
                      {/* Day number + mood dot */}
                      <div className="flex items-start justify-between">
                        <span
                          className={cn(
                            "mono text-lg font-semibold",
                            isSelected ? "text-text" : "text-text-dim"
                          )}
                        >
                          {day.day}
                        </span>
                        {day.entry?.mood != null && (
                          <span
                            className="w-1.5 h-1.5 rounded-full block mt-1"
                            style={{ background: moodColor(day.entry.mood) }}
                          />
                        )}
                      </div>

                      <div className="flex-1" />

                      <div>
                        <div
                          className="mono text-md font-semibold"
                          style={{
                            color: day.net >= 0
                              ? "var(--color-profit)"
                              : "var(--color-loss)",
                          }}
                        >
                          {day.net >= 0 ? "+" : "−"}$
                          {Math.abs(day.net).toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })}
                        </div>
                        <div className="mono text-xxs text-text-mute mt-0.5">
                          {day.tradeCount} trade{day.tradeCount !== 1 ? "s" : ""}
                        </div>
                      </div>

                      {/* Bottom P&L bar */}
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-b-sm"
                        style={{
                          height:     3,
                          background: day.net >= 0
                            ? "var(--color-profit)"
                            : "var(--color-loss)",
                          opacity: 0.6,
                        }}
                      />
                    </button>
                  )
                })}

                {/* Week total */}
                <div className="bg-bg border border-border rounded-sm p-2 flex flex-col justify-between jcal-week-col">
                  <div className="mono text-xxs text-text-mute tracking-widest">
                    W{wi + 1}
                  </div>
                  <div>
                    <div
                      className="mono text-base font-semibold"
                      style={{
                        color:
                          wNet > 0
                            ? "var(--color-profit)"
                            : wNet < 0
                            ? "var(--color-loss)"
                            : "var(--color-text-mute)",
                      }}
                    >
                      {wNet !== 0
                        ? (wNet >= 0 ? "+" : "−") +
                          "$" +
                          (Math.abs(wNet) >= 1000
                            ? (Math.abs(wNet) / 1000).toFixed(1) + "k"
                            : Math.abs(wNet).toFixed(0))
                        : "—"}
                    </div>
                    {wCount > 0 && (
                      <div className="mono text-xxs text-text-mute mt-0.5">
                        {wCount} tr
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Overlay drawer — fixed, outside flex flow */}
      {selectedDay && (
        <DayDrawer
          key={selectedDate}
          day={selectedDay}
          accounts={accounts}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  )
}
