"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactElement, ReactNode } from "react"
import type { JournalDay } from "~/types/journal"
import type { Account } from "~/types"
import { upsertJournalEntry } from "~/actions/journal"
import { JOURNAL } from "~/constants/copies/journal"
import { formatCurrency, formatPct } from "~/helpers/format"
import { useTimezone } from "~/hooks/use-timezone"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import { XIcon } from "~/lib/ui/icons/x-icon"
import { cn } from "~/utils/cn"

const MOODS = JOURNAL.MOODS

type Draft = {
  preMarketNotes: string
  postMarketNotes: string
  mood: number | null
  followedPlan: boolean
}

function initDraft(day: JournalDay): Draft {
  return {
    preMarketNotes: day.entry?.preMarketNotes ?? "",
    postMarketNotes: day.entry?.postMarketNotes ?? "",
    mood: day.entry?.mood ?? null,
    followedPlan: day.entry?.followedPlan ?? false,
  }
}

type ToastState = { message: string; variant: ToastVariant }

type Props = {
  day:      JournalDay
  accounts: Account[]
  onClose:  () => void
}

export function DayDrawer({ day, accounts, onClose }: Props): ReactElement {
  const accountMap = new Map(accounts.map(a => [a.id, a]))
  const router = useRouter()
  const timeZone = useTimezone()
  const [draft, setDraft] = useState<Draft>(() => initDraft(day))
  const [toast, setToast] = useState<ToastState | null>(null)
  const [isPending, startTransition] = useTransition()

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 3500)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await upsertJournalEntry({
        date: day.date,
        preMarketNotes: draft.preMarketNotes.trim() || null,
        postMarketNotes: draft.postMarketNotes.trim() || null,
        mood: draft.mood,
        followedPlan: draft.followedPlan,
      })
      if (result.success) {
        showToast(JOURNAL.TOAST.SAVE_SUCCESS, "success")
        router.refresh()
      } else {
        showToast(JOURNAL.TOAST.SAVE_ERROR, "error")
      }
    })
  }

  const [dateYear, dateMon, dateDayNum] = day.date.split("-").map(Number)
  const dateObj = new Date(dateYear!, dateMon! - 1, dateDayNum!)
  const weekday = dateObj.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()
  const fullDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })

  return (
    <>
      <style>{`
        @keyframes drawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .day-drawer { width: 100%; }
        @media (min-width: 768px) { .day-drawer { width: 460px; } }
      `}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      <aside
        className="day-drawer fixed top-0 right-0 h-full z-40 flex flex-col bg-surface overflow-hidden"
        style={{
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
          animation: "drawerSlideIn .25s cubic-bezier(.2,.7,.3,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div>
            <div className="label-caps tracking-widest">{weekday}</div>
            <div className="mono text-2xl font-semibold text-text tracking-tight mt-0.5">
              {fullDate}
            </div>
          </div>
          <Button variant="icon" onClick={onClose} className="shrink-0 mt-0.5">
            <XIcon />
          </Button>
        </div>

        {/* Stat strip */}
        <div
          className="grid p-3 border-b border-border"
          style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}
        >
          <div>
            <div className="label-caps mb-1">{JOURNAL.DRAWER.NET_LABEL}</div>
            <div
              className="mono text-xl font-semibold"
              style={{
                color: day.net > 0
                  ? "var(--color-profit)"
                  : day.net < 0
                    ? "var(--color-loss)"
                    : "var(--color-text-dim)",
              }}
            >
              {formatCurrency(day.net, { decimals: 0 })}
            </div>
          </div>
          <div>
            <div className="label-caps mb-1">{JOURNAL.DRAWER.TRADES_COUNT}</div>
            <div className="mono text-xl font-semibold text-text">{day.tradeCount}</div>
          </div>
          <div>
            <div className="label-caps mb-1">{JOURNAL.DRAWER.WIN_RATE}</div>
            <div
              className="mono text-xl font-semibold"
              style={{ color: "var(--color-accent)" }}
            >
              {day.tradeCount > 0 ? formatPct(day.winRate, 0) : "—"}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          {/* Mood */}
          <DrawerField label={JOURNAL.DRAWER.MOOD_LABEL}>
            <div className="grid grid-cols-5 gap-1.5">
              {MOODS.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, mood: d.mood === m.v ? null : m.v }))
                  }
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-sm border transition-colors cursor-pointer",
                    draft.mood === m.v
                      ? "border-accent bg-surface-2"
                      : "border-border hover:border-border-hi"
                  )}
                >
                  <span
                    className="rounded-full block"
                    style={{
                      width: 10,
                      height: 10,
                      background: draft.mood === m.v ? m.color : "var(--color-border-hi)",
                      transition: "background 0.15s",
                    }}
                  />
                  <span className="label-caps">{m.label}</span>
                </button>
              ))}
            </div>
          </DrawerField>

          {/* Discipline */}
          <DrawerField label={JOURNAL.DRAWER.DISC_LABEL}>
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, followedPlan: !d.followedPlan }))
              }
              className="w-full flex items-center gap-3 p-3 bg-surface-2 rounded-sm border border-border hover:border-border-hi transition-colors cursor-pointer"
            >
              <span
                className="relative shrink-0 rounded-full transition-colors"
                style={{
                  width: 34,
                  height: 18,
                  background:
                    draft.followedPlan === true
                      ? "var(--color-accent)"
                      : "var(--color-border)",
                }}
              >
                <span
                  className="absolute top-0.5 rounded-full transition-all"
                  style={{
                    left: draft.followedPlan === true ? 18 : 2,
                    width: 14,
                    height: 14,
                    background: "#0a0a0f",
                  }}
                />
              </span>
              <span className="flex-1 text-left text-base text-text">
                {JOURNAL.DRAWER.DISC_TOGGLE}
              </span>
              <span className="text-xs text-text-mute">
                {draft.followedPlan ? JOURNAL.DRAWER.DISC_YES : JOURNAL.DRAWER.DISC_NO}
              </span>
            </button>
          </DrawerField>

          {/* Pre-market */}
          <DrawerField label={JOURNAL.DRAWER.PRE_LABEL}>
            <textarea
              value={draft.preMarketNotes}
              onChange={(e) =>
                setDraft((d) => ({ ...d, preMarketNotes: e.target.value }))
              }
              placeholder={JOURNAL.DRAWER.PRE_PLACEHOLDER}
              rows={3}
              className="w-full bg-surface-2 border border-border rounded-sm p-2.5 text-base text-text resize-y outline-none focus:border-border-hi"
            />
          </DrawerField>

          {/* Post-market */}
          <DrawerField label={JOURNAL.DRAWER.POST_LABEL}>
            <textarea
              value={draft.postMarketNotes}
              onChange={(e) =>
                setDraft((d) => ({ ...d, postMarketNotes: e.target.value }))
              }
              placeholder={JOURNAL.DRAWER.POST_PLACEHOLDER}
              rows={3}
              className="w-full bg-surface-2 border border-border rounded-sm p-2.5 text-base text-text resize-y outline-none focus:border-border-hi"
            />
          </DrawerField>

          {/* Trades */}
          {day.trades.length > 0 && (
            <DrawerField label={`${JOURNAL.DRAWER.TRADES_LABEL} · ${day.tradeCount}`}>
              <div className="flex flex-col gap-1">
                {day.trades.map((t) => {
                  const time = new Date(t.entryTime).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone,
                  })
                  return (
                    <Link
                      key={t.id}
                      href={`/trades/${t.id}`}
                      className="grid items-center bg-surface-2 rounded-sm px-2 py-1.5 border border-transparent hover:border-border transition-colors"
                      style={{ gridTemplateColumns: "44px auto 1fr auto auto", gap: 8 }}
                    >
                      <span className="mono text-xxs text-text-mute">{time}</span>
                      {(() => {
                        const acc = accountMap.get(t.accountId)
                        return acc ? (
                          <span
                            className="mono text-xxs px-1.5 py-0.5 rounded-xs truncate"
                            style={{
                              color:      acc.color,
                              background: `${acc.color}18`,
                              border:     `1px solid ${acc.color}40`,
                              maxWidth:   72,
                            }}
                          >
                            {acc.name}
                          </span>
                        ) : <span />
                      })()}
                      <span className="mono text-sm font-semibold text-text truncate">
                        {t.instrument}{" "}
                        <span className="text-text-mute font-normal">× {t.contracts}</span>
                      </span>
                      <span
                        className="mono text-xxs font-semibold px-1.5 py-0.5 rounded-xs"
                        style={
                          t.direction === "long"
                            ? {
                              color: "var(--color-long)",
                              background: "rgba(59,130,246,0.1)",
                              border: "1px solid rgba(59,130,246,0.3)",
                            }
                            : {
                              color: "var(--color-short)",
                              background: "rgba(245,158,11,0.1)",
                              border: "1px solid rgba(245,158,11,0.3)",
                            }
                        }
                      >
                        {t.direction.toUpperCase()}
                      </span>
                      <span
                        className="mono text-sm font-semibold"
                        style={{
                          color:
                            t.netPnl > 0
                              ? "var(--color-profit)"
                              : t.netPnl < 0
                                ? "var(--color-loss)"
                                : "var(--color-text-dim)",
                        }}
                      >
                        {formatCurrency(t.netPnl, { decimals: 0 })}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </DrawerField>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-3.5 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => setDraft(initDraft(day))}
            disabled={isPending}
          >
            {JOURNAL.DRAWER.DISCARD}
          </Button>
          <div className="flex-1" />
          <Button
            variant="accent"
            onClick={handleSave}
            disabled={isPending}
            loading={isPending}
          >
            {JOURNAL.DRAWER.SAVE}
          </Button>
        </div>
      </aside>
    </>
  )
}

function DrawerField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}): ReactElement {
  return (
    <div>
      <div className="label-caps tracking-widest mb-1.5">{label}</div>
      {children}
    </div>
  )
}
