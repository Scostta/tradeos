"use client"

import { useState, useTransition, useCallback } from "react"
import { updateTradeNotes, updateTradePlaybook, updateTradeTags, updateTradeFollowedRules, updateTradeMistakes } from "~/actions/trades"
import { TradeExecutionsCard } from "./trade-executions-card"
import { TradeAttachmentsCard } from "./trade-attachments-card.client"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import { toggleFollowed } from "~/helpers/followed-rules"
import { gradeForRules } from "~/lib/calculations/trade-grade"
import { GradeBadge } from "~/components/grade-badge"
import { useTradeSetup } from "./trade-setup-context.client"
import { useTimezone } from "~/hooks/use-timezone"
import { MISTAKE_PRESETS } from "~/constants/trade-mistakes"
import { TRADES } from "~/constants/copies/trades"
import type { Trade } from "~/types/trade"
import type { Playbook } from "~/types/playbook"

const SIDEBAR = TRADES.SIDEBAR

type Props = {
  trade: Trade
  playbooks: Playbook[]
}

export function TradeSidebar({ trade, playbooks }: Props) {
  const timeZone = useTimezone()
  const [notes, setNotes] = useState(trade.notes ?? "")
  const { playbookId, followedRules, setPlaybookId, setFollowedRules } = useTradeSetup()
  const [pendingPlaybookId, setPendingPlaybookId] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>(trade.tags ?? [])
  const [newTag, setNewTag] = useState("")
  const [addingTag, setAddingTag] = useState(false)
  const [mistakes, setMistakes] = useState<string[]>(trade.mistakes ?? [])
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [isPending, startTransition] = useTransition()

  const handleSaveNotes = useCallback(() => {
    startTransition(async () => {
      await updateTradeNotes({ id: trade.id, notes: notes.trim() || null })
      setSavedAt(new Date())
    })
  }, [trade.id, notes])

  // The checklist holds the current playbook's criterion ids, so a playbook
  // change clears it (server-side too). Ask first when there is one to lose.
  const applyPlaybookChange = useCallback((newId: string | null) => {
    setPendingPlaybookId(null)
    setPlaybookId(newId)
    setFollowedRules(null)
    startTransition(async () => {
      await updateTradePlaybook({ id: trade.id, playbookId: newId })
    })
  }, [trade.id, setPlaybookId, setFollowedRules])

  const handlePlaybookChange = useCallback((value: string) => {
    const newId = value || null
    if (newId === playbookId) { setPendingPlaybookId(null); return }
    if (followedRules !== null) { setPendingPlaybookId(value); return }
    applyPlaybookChange(newId)
  }, [playbookId, followedRules, applyPlaybookChange])

  const toggleRule = useCallback((id: string) => {
    const next = toggleFollowed(followedRules, id)
    setFollowedRules(next)
    startTransition(async () => {
      await updateTradeFollowedRules({ id: trade.id, followedRules: next })
    })
  }, [trade.id, followedRules, setFollowedRules])

  const parsedRules = parsePlaybookRules(playbooks.find(p => p.id === playbookId)?.rules ?? null)
  const ruleGroups: { key: "entry" | "exit" | "conditions"; label: string }[] = [
    { key: "entry",      label: SIDEBAR.GROUP_ENTRY },
    { key: "exit",       label: SIDEBAR.GROUP_EXIT },
    { key: "conditions", label: SIDEBAR.GROUP_CONDITIONS },
  ]
  const ticked           = new Set(followedRules ?? [])
  const confirmations    = parsedRules.entry.filter(c => !c.required)
  const metConfirmations = confirmations.filter(c => ticked.has(c.id)).length
  const grade            = gradeForRules(parsedRules, followedRules)

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

  const toggleMistake = useCallback((mistake: string) => {
    const updated = mistakes.includes(mistake)
      ? mistakes.filter(m => m !== mistake)
      : [...mistakes, mistake]
    setMistakes(updated)
    startTransition(async () => {
      await updateTradeMistakes({ id: trade.id, mistakes: updated.length ? updated : null })
    })
  }, [trade.id, mistakes])

  const savedLabel = savedAt
    ? `${SIDEBAR.AUTOSAVED} · ${savedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone })}`
    : null

  return (
    <div className="flex flex-col gap-4 min-w-0 h-full">

      {/* Playbook */}
      <div className="card p-4">
        <div className="label-caps mb-2">{SIDEBAR.PLAYBOOK}</div>
        <select
          value={pendingPlaybookId ?? playbookId ?? ""}
          onChange={e => handlePlaybookChange(e.target.value)}
          className="w-full px-2.5 py-2 bg-surface-2 border border-border rounded-sm text-text text-base font-[inherit] outline-none focus:border-border-hi"
        >
          <option value="">{SIDEBAR.NONE}</option>
          {playbooks.filter(s => s.active || s.id === playbookId).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {pendingPlaybookId !== null && (
          <div className="mt-2 rounded-sm border border-short/40 bg-short/10 p-2.5 flex flex-col gap-2">
            <p className="text-xs text-text-dim">{SIDEBAR.PLAYBOOK_CHANGE_WARNING}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyPlaybookChange(pendingPlaybookId || null)}
                disabled={isPending}
                className="btn-accent py-1 px-2.5 text-xs disabled:opacity-60"
              >
                {SIDEBAR.PLAYBOOK_CHANGE_CONFIRM}
              </button>
              <button
                type="button"
                onClick={() => setPendingPlaybookId(null)}
                className="text-xs text-text-mute hover:text-text transition-colors cursor-pointer"
              >
                {SIDEBAR.PLAYBOOK_CHANGE_CANCEL}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Setup checklist — grouped, with per-group minimums */}
      {parsedRules.all.length > 0 && (
        <div className="card p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="label-caps">{SIDEBAR.SETUP_CHECKLIST}</div>
            {parsedRules.entry.length > 0 && <GradeBadge grade={grade} showUngraded />}
          </div>

          <div className="flex flex-col gap-3">
            {ruleGroups.map(({ key, label }) => {
              if (parsedRules[key].length === 0) return null
              // Entry is graded (required + confirmations); exit/conditions keep their minimum.
              const isEntry = key === "entry"
              const met     = parsedRules[key].filter(c => ticked.has(c.id)).length
              const min     = key === "entry" ? 0 : parsedRules.min[key]
              const groupOk = met >= min
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xxs uppercase tracking-wider text-text-mute">{label}</span>
                    {isEntry ? (
                      <span className="mono text-xxs text-text-mute">
                        {metConfirmations}/{confirmations.length} {SIDEBAR.CONFIRMATIONS}
                      </span>
                    ) : (
                      <span className="mono text-xxs" style={{ color: groupOk ? "var(--color-profit)" : "var(--color-text-mute)" }}>
                        {met}/{parsedRules[key].length} · {SIDEBAR.MIN} {min}
                      </span>
                    )}
                  </div>
                  {parsedRules[key].map(rule => {
                    const checked  = ticked.has(rule.id)
                    const required = isEntry && parsedRules.entry.some(c => c.id === rule.id && c.required)
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => toggleRule(rule.id)}
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
                          {rule.text}
                          {required && (
                            <span className="ml-1.5 text-xxs mono uppercase tracking-wider text-short">{SIDEBAR.REQUIRED}</span>
                          )}
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
          <div className="label-caps">{SIDEBAR.NOTES}</div>
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
          placeholder={SIDEBAR.NOTES_PLACEHOLDER}
        />
        <div className="mt-3 pt-3 flex items-center gap-2">
          <button
            onClick={handleSaveNotes}
            disabled={isPending}
            className="btn-accent py-1.75 px-3.5 disabled:opacity-60"
          >
            {SIDEBAR.SAVE}
          </button>
          <div className="flex-1" />
          <span className="mono text-xs text-text-mute">{SIDEBAR.SAVE_SHORTCUT}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="card p-4">
        <div className="label-caps mb-3">{SIDEBAR.TAGS}</div>
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
              {SIDEBAR.ADD_TAG}
            </button>
          )}
        </div>
      </div>

      {/* Mistakes */}
      <div className="card p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="label-caps">{SIDEBAR.MISTAKES}</div>
          {mistakes.length > 0 && (
            <span className="mono text-xs text-loss">{mistakes.length}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {MISTAKE_PRESETS.filter(m => !mistakes.includes(m)).length === MISTAKE_PRESETS.length && mistakes.length === 0 && (
            <span className="text-xs text-text-mute italic">{SIDEBAR.MISTAKES_HINT}</span>
          )}
          {/* Selected mistakes */}
          {mistakes.map(m => (
            <button
              key={m}
              onClick={() => toggleMistake(m)}
              disabled={isPending}
              className="group text-sm px-2 py-0.5 rounded-xs bg-loss/10 text-loss border border-loss/30 hover:border-loss transition-colors disabled:opacity-60"
            >
              {m}
              <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">×</span>
            </button>
          ))}
          {/* Preset quick-add (not yet selected) */}
          {MISTAKE_PRESETS.filter(m => !mistakes.includes(m)).map(m => (
            <button
              key={m}
              onClick={() => toggleMistake(m)}
              disabled={isPending}
              className="text-sm px-2 py-0.5 rounded-xs text-text-mute border border-dashed border-border hover:border-loss hover:text-loss transition-colors disabled:opacity-60"
            >
              + {m}
            </button>
          ))}
        </div>
      </div>

      {/* Attachments */}
      <TradeAttachmentsCard tradeId={trade.id} />

    </div>
  )
}
