"use client"

import { useState, useTransition } from "react"
import { updateTradeNotes } from "~/actions/trades"
import type { Trade } from "~/types/trade"

type NoteTab = "trade" | "journal"

export function NotesBar({ trade }: { trade: Trade }) {
  const [tab,        setTab]        = useState<NoteTab>("trade")
  const [notes,      setNotes]      = useState(trade.notes ?? "")
  const [savedAt,    setSavedAt]    = useState<Date | null>(null)
  const [isPending,  startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      await updateTradeNotes({ id: trade.id, notes: notes.trim() || null })
      setSavedAt(new Date())
    })
  }

  return (
    <div
      className="flex flex-col shrink-0 border-t border-border bg-surface"
      style={{ height: 140 }}
    >
      {/* Notes toolbar */}
      <div className="flex items-center gap-0 border-b border-border shrink-0" style={{ height: 32 }}>
        <span className="label-caps px-3 text-text-dim">Notes</span>
        <span className="w-px h-4 bg-border mx-1" />
        {([
          { id: "trade",   label: "Trade note" },
          { id: "journal", label: "Daily journal" },
        ] as { id: NoteTab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 h-full text-xs transition-colors border-b-2"
            style={{
              color:       tab === t.id ? "var(--color-text)"     : "var(--color-text-mute)",
              borderColor: tab === t.id ? "var(--color-accent)"   : "transparent",
              background:  "transparent",
              cursor:      "pointer",
            }}
          >
            {t.label}
          </button>
        ))}

        <div className="flex-1" />

        {savedAt && (
          <span className="mono text-xxs text-text-mute mr-3">
            autosaved · {savedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
        )}

        {tab === "trade" && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="mr-2 px-2.5 py-0.5 rounded-xs text-xxs font-semibold disabled:opacity-60 transition-opacity"
            style={{
              background: "var(--color-accent)",
              color:      "#0a0a0f",
              border:     "none",
              cursor:     "pointer",
            }}
          >
            Save
          </button>
        )}
      </div>

      {/* Content */}
      {tab === "trade" ? (
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
              e.preventDefault()
              handleSave()
            }
          }}
          placeholder="Add trade notes… What happened? What did you learn? (⌘S to save)"
          className="flex-1 resize-none bg-transparent px-4 py-2 text-xs text-text outline-none leading-relaxed font-[inherit] placeholder:text-text-mute"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-text-mute">Open the Journal to add daily notes for this day.</p>
        </div>
      )}
    </div>
  )
}
