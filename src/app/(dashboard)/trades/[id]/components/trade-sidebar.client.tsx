"use client"

import { useState, useTransition, useCallback } from "react"
import { updateTradeNotes, updateTradePlaybook, updateTradeTags } from "~/actions/trades"
import { TradeExecutionsCard } from "./trade-executions-card"
import { TradeAttachmentsCard } from "./trade-attachments-card.client"
import type { Trade } from "~/types/trade"
import type { Playbook } from "~/types/playbook"

type Props = {
  trade: Trade
  playbooks: Playbook[]
}

export function TradeSidebar({ trade, playbooks }: Props) {
  const [notes, setNotes] = useState(trade.notes ?? "")
  const [playbookId, setPlaybookId] = useState(trade.playbookId ?? "")
  const [tags, setTags] = useState<string[]>(trade.tags ?? [])
  const [newTag, setNewTag] = useState("")
  const [addingTag, setAddingTag] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [isPending, startTransition] = useTransition()

  const handleSaveNotes = useCallback(() => {
    startTransition(async () => {
      await updateTradeNotes({ id: trade.id, notes: notes.trim() || null })
      setSavedAt(new Date())
    })
  }, [trade.id, notes])

  const handlePlaybookChange = useCallback((newId: string) => {
    setPlaybookId(newId)
    startTransition(async () => {
      await updateTradePlaybook({ id: trade.id, playbookId: newId || null })
    })
  }, [trade.id])

  const commitTag = useCallback(() => {
    const trimmed = newTag.trim()
    if (!trimmed) { setAddingTag(false); return }
    const updated = [...tags, trimmed]
    setTags(updated)
    setNewTag("")
    setAddingTag(false)
    startTransition(async () => {
      await updateTradeTags({ id: trade.id, tags: updated })
    })
  }, [trade.id, tags, newTag])

  const removeTag = useCallback((tag: string) => {
    const updated = tags.filter(t => t !== tag)
    setTags(updated)
    startTransition(async () => {
      await updateTradeTags({ id: trade.id, tags: updated })
    })
  }, [trade.id, tags])

  const savedLabel = savedAt
    ? `autosaved · ${savedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`
    : null

  return (
    <div className="flex flex-col gap-4 min-w-0 h-full">

      {/* Playbook */}
      <div className="card p-4">
        <div className="label-caps mb-2">Playbook</div>
        <select
          value={playbookId}
          onChange={e => handlePlaybookChange(e.target.value)}
          className="w-full px-2.5 py-2 bg-surface-2 border border-border rounded-sm text-text text-base font-[inherit] outline-none focus:border-border-hi"
        >
          <option value="">— None —</option>
          {playbooks.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Executions */}
      <TradeExecutionsCard trade={trade} />

      {/* Notes — flex-1 fills remaining vertical space */}
      <div className="card p-4 flex flex-col flex-1 min-h-0">
        <div className="flex justify-between items-center mb-2">
          <div className="label-caps">Notes</div>
          {savedLabel && (
            <span className="mono text-xs text-text-mute">{savedLabel}</span>
          )}
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
              e.preventDefault()
              handleSaveNotes()
            }
          }}
          className="flex-1 min-h-0 bg-surface-2 border border-border rounded-sm p-2.5 text-text text-base leading-relaxed resize-none font-[inherit] outline-none focus:border-border-hi transition-colors"
          placeholder="What happened? What did you learn?"
        />
        <div className="mt-3 pt-3 flex items-center gap-2">
          <button
            onClick={handleSaveNotes}
            disabled={isPending}
            className="btn-accent py-1.75 px-3.5 disabled:opacity-60"
          >
            Save
          </button>
          <div className="flex-1" />
          <span className="mono text-xs text-text-mute">⌘S</span>
        </div>
      </div>

      {/* Tags */}
      <div className="card p-4">
        <div className="label-caps mb-3">Tags</div>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => removeTag(tag)}
              className="group text-sm px-2 py-0.5 rounded-xs bg-surface-2 text-text-dim border border-border hover:border-loss hover:text-loss transition-colors"
            >
              {tag}
              <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">×</span>
            </button>
          ))}

          {addingTag ? (
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") commitTag()
                if (e.key === "Escape") { setAddingTag(false); setNewTag("") }
              }}
              onBlur={commitTag}
              autoFocus
              maxLength={40}
              className="text-sm px-2 py-0.5 rounded-xs bg-surface-2 text-text border border-accent outline-none w-24 font-[inherit]"
            />
          ) : (
            <button
              onClick={() => setAddingTag(true)}
              className="text-sm px-2 py-0.5 rounded-xs text-text-mute border border-dashed border-border hover:border-border-hi hover:text-text-dim transition-colors cursor-pointer"
            >
              + add
            </button>
          )}
        </div>
      </div>

      {/* Attachments */}
      <TradeAttachmentsCard tradeId={trade.id} />

    </div>
  )
}
