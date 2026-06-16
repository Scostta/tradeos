"use client"

import { useState, useTransition, useCallback } from "react"
import { updateTradeNotes, updateTradePlaybook, updateTradeTags, updateTradeFollowedRules } from "~/actions/trades"
import { TradeExecutionsCard } from "./trade-executions-card"
import { TradeAttachmentsCard } from "./trade-attachments-card.client"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import type { Trade } from "~/types/trade"
import type { Playbook } from "~/types/playbook"

type Props = {
  trade: Trade
  playbooks: Playbook[]
}

export function TradeSidebar({ trade, playbooks }: Props) {
  const [notes, setNotes] = useState(trade.notes ?? "")
  const [playbookId, setPlaybookId] = useState(trade.playbookId ?? "")
  const [followedRules, setFollowedRules] = useState<string[]>(trade.followedRules ?? [])
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

  const toggleRule = useCallback((rule: string) => {
    const next = followedRules.includes(rule)
      ? followedRules.filter(r => r !== rule)
      : [...followedRules, rule]
    setFollowedRules(next)
    startTransition(async () => {
      await updateTradeFollowedRules({ id: trade.id, followedRules: next.length ? next : null })
    })
  }, [trade.id, followedRules])

  const parsedRules = parsePlaybookRules(playbooks.find(p => p.id === playbookId)?.rules ?? null)
  const ruleGroups: { key: "entry" | "exit" | "conditions"; label: string }[] = [
    { key: "entry",      label: "Entry" },
    { key: "exit",       label: "Exit" },
    { key: "conditions", label: "Conditions" },
  ]
  const metInGroup = (g: "entry" | "exit" | "conditions") =>
    parsedRules[g].filter(r => followedRules.includes(r)).length
  const setupValid = parsedRules.all.length > 0 &&
    ruleGroups.every(({ key }) => metInGroup(key) >= parsedRules.min[key])

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

      {/* Setup checklist — grouped, with per-group minimums */}
      {parsedRules.all.length > 0 && (
        <div className="card p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="label-caps">Setup checklist</div>
            <span
              className="text-xxs mono font-semibold tracking-wider rounded-sm px-2 py-0.5"
              style={{
                color:      setupValid ? "var(--color-profit)" : "var(--color-text-mute)",
                background: setupValid ? "color-mix(in srgb, var(--color-profit) 14%, transparent)" : "var(--color-surface-2)",
              }}
            >
              {setupValid ? "VALID" : "INCOMPLETE"}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {ruleGroups.map(({ key, label }) => {
              if (parsedRules[key].length === 0) return null
              const met      = metInGroup(key)
              const min      = parsedRules.min[key]
              const groupOk  = met >= min
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xxs uppercase tracking-wider text-text-mute">{label}</span>
                    <span className="mono text-xxs" style={{ color: groupOk ? "var(--color-profit)" : "var(--color-text-mute)" }}>
                      {met}/{parsedRules[key].length} · min {min}
                    </span>
                  </div>
                  {parsedRules[key].map(rule => {
                    const checked = followedRules.includes(rule)
                    return (
                      <button
                        key={rule}
                        type="button"
                        onClick={() => toggleRule(rule)}
                        disabled={isPending}
                        className="flex items-start gap-2 text-left disabled:opacity-60 cursor-pointer group"
                      >
                        <span
                          className="shrink-0 mt-0.5 flex items-center justify-center w-4 h-4 rounded-xs border transition-colors"
                          style={{
                            background:  checked ? "var(--color-accent)" : "transparent",
                            borderColor: checked ? "var(--color-accent)" : "var(--color-border-hi)",
                            color:       "var(--color-bg)",
                          }}
                        >
                          {checked && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span className={checked ? "text-sm text-text" : "text-sm text-text-dim group-hover:text-text"}>
                          {rule}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
