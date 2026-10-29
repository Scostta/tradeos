"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import type { ReactElement } from "react"
import Link from "next/link"
import { reviewTrade } from "~/actions/trades"
import { isReviewed } from "~/helpers/trade-review"
import { REVIEW } from "~/constants/copies/review"
import { MISTAKE_PRESETS } from "~/constants/trade-mistakes"
import { GradeBadge } from "~/components/grade-badge"
import { BeOverrideToggle } from "~/components/trades/be-override-toggle.client"
import { formatCurrency } from "~/helpers/format"
import { toggleFollowed } from "~/helpers/followed-rules"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import { zonedParts } from "~/helpers/tz"
import { useTimezone } from "~/hooks/use-timezone"
import { gradeForRules } from "~/lib/calculations/trade-grade"
import { Spinner } from "~/lib/ui/spinner"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { Account } from "~/types/account"
import type { Playbook } from "~/types/playbook"
import type { Trade } from "~/types/trade"
import { cn } from "~/utils/cn"

type Draft = { playbookId: string | null; followedRules: string[] | null; mistakes: string[]; notes: string }

const draftOf = (t: Trade): Draft => ({
  playbookId: t.playbookId, followedRules: t.followedRules, mistakes: t.mistakes ?? [], notes: t.notes ?? "",
})

// Color del P&L: gris si es BE (no cuenta como ganador ni perdedor).
function pnlClass(t: Trade): string {
  if (t.breakEven) return "text-text-dim"
  return t.netPnl > 0 ? "text-profit" : t.netPnl < 0 ? "text-loss" : "text-text-dim"
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

// Repaso de sesión: los trades del día uno a uno. ↑↓ cambia de trade, 1–9
// elige playbook, Enter guarda y pasa al siguiente sin revisar.
export function ReviewView({ trades, playbooks, accounts }: {
  trades:    Trade[]
  playbooks: Playbook[]
  accounts:  Account[]
}): ReactElement {
  const tz = useTimezone()
  const active = useMemo(() => playbooks.filter(p => p.active), [playbooks])
  const rulesById = useMemo(() => new Map(playbooks.map(p => [p.id, parsePlaybookRules(p.rules)])), [playbooks])
  const accountsById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(trades.map(t => [t.id, draftOf(t)])))
  const [saved, setSaved] = useState<Record<string, boolean>>(() => Object.fromEntries(trades.map(t => [t.id, isReviewed(t)])))
  const [selectedId, setSelectedId] = useState<string | null>(() => trades.find(t => !isReviewed(t))?.id ?? trades[0]?.id ?? null)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [pending, startTransition] = useTransition()
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const selected = trades.find(t => t.id === selectedId) ?? null
  const draft = selected ? drafts[selected.id]! : null
  const rules = draft?.playbookId ? rulesById.get(draft.playbookId) ?? null : null

  function showToast(message: string, variant: ToastVariant = "success") {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 2500)
  }

  function patch(p: Partial<Draft>) {
    if (!selected) return
    setDrafts(d => ({ ...d, [selected.id]: { ...d[selected.id]!, ...p } }))
  }

  function pickPlaybook(id: string | null) {
    if (!draft || id === draft.playbookId) return
    patch({ playbookId: id, followedRules: id ? [] : null })   // checklist nuevo: empieza en "ninguna"
  }

  function move(delta: number) {
    if (!selected) return
    const i = trades.findIndex(t => t.id === selected.id)
    const next = trades[Math.max(0, Math.min(trades.length - 1, i + delta))]
    if (next) setSelectedId(next.id)
  }

  function save() {
    if (!selected || !draft || pending) return
    const id = selected.id
    const d = draft
    startTransition(async () => {
      const res = await reviewTrade({
        id, playbookId: d.playbookId, followedRules: d.followedRules,
        mistakes: d.mistakes.length ? d.mistakes : null, notes: d.notes.trim() || null,
      })
      if (!res.success) { showToast(REVIEW.ERROR, "error"); return }
      setSaved(s => ({ ...s, [id]: true }))
      showToast(REVIEW.SAVED)
      // Siguiente sin revisar después de este; si no hay, el siguiente a secas.
      const i = trades.findIndex(t => t.id === id)
      const next = trades.slice(i + 1).find(t => !saved[t.id] && t.id !== id) ?? trades[i + 1]
      if (next) setSelectedId(next.id)
    })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target)) return
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); move(e.key === "ArrowDown" ? 1 : -1); return }
      if (e.key === "Enter") { e.preventDefault(); save(); return }
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= 9 && active[n - 1]) { e.preventDefault(); pickPlaybook(active[n - 1]!.id) }
      if (e.key === "0") { e.preventDefault(); pickPlaybook(null) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const time = (iso: string) => {
    const p = zonedParts(iso, tz)
    return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      {toast && <div className="fixed top-4 right-4 z-50"><Toast variant={toast.variant} message={toast.message} /></div>}

      <div className="card p-0 min-w-0" style={{ flex: "1 1 320px", maxWidth: 440 }}>
        {trades.map(t => {
          const account = accountsById.get(t.accountId)
          const done = saved[t.id]
          return (
            <button
              key={t.id} type="button" onClick={() => setSelectedId(t.id)}
              className={cn(
                "w-full text-left grid items-center gap-2 px-3 py-2.5 border-b border-border last:border-0 cursor-pointer transition-colors",
                t.id === selectedId ? "bg-surface-2" : "hover:bg-surface-2",
              )}
              style={{ gridTemplateColumns: "10px 44px 1fr auto auto" }}
            >
              <span className="size-2 rounded-full" style={{ background: account?.color ?? "var(--color-text-mute)" }} title={account?.name} />
              <span className="mono text-xs text-text-dim">{time(t.entryTime)}</span>
              <span className="mono text-xs text-text truncate">
                {t.instrument} <span className={t.direction === "long" ? "text-long" : "text-short"}>{t.direction === "long" ? "L" : "S"}</span> ×{t.contracts}
              </span>
              <span className={cn("mono text-xs text-right", pnlClass(t))}>
                {t.breakEven && <span className="text-text-mute mr-1">{REVIEW.BE_MARK}</span>}{formatCurrency(t.netPnl)}
              </span>
              <span className={cn("size-4.5 rounded-full flex items-center justify-center text-xs", done ? "bg-accent/15 text-accent" : "border border-border-hi")} aria-label={done ? REVIEW.REVIEWED : REVIEW.PENDING}>
                {done ? "✓" : ""}
              </span>
            </button>
          )
        })}
      </div>

      {selected && draft && (
        <div className="card p-0 min-w-0 flex flex-col" style={{ flex: "999 1 420px" }}>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border">
            <span className="mono text-md font-semibold text-text">{selected.instrument}</span>
            <span className={cn("text-xs font-semibold uppercase", selected.direction === "long" ? "text-long" : "text-short")}>{selected.direction}</span>
            <span className="mono text-xs text-text-dim">{time(selected.entryTime)} → {time(selected.exitTime)}</span>
            <span className={cn("mono text-sm font-semibold", pnlClass(selected))}>
              {selected.breakEven && <span className="text-text-mute font-normal mr-1">{REVIEW.BE_MARK}</span>}{formatCurrency(selected.netPnl)}
            </span>
            <GradeBadge grade={rules ? gradeForRules(rules, draft.followedRules) : null} showUngraded className="ml-auto" />
            <Link href={`/trades/${selected.id}`} className="text-xs text-text-mute hover:text-text">{REVIEW.OPEN_TRADE}</Link>
          </div>

          <div className="flex flex-col gap-4 px-4 py-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="label-caps">{REVIEW.PLAYBOOK}</span>
                <span className="text-xs text-text-mute ml-auto">{REVIEW.PLAYBOOK_KEYS}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {active.map((p, i) => (
                  <button
                    key={p.id} type="button" onClick={() => pickPlaybook(p.id)}
                    className={cn("btn-ghost px-2.5 py-1.5 text-xs inline-flex items-center gap-1.5", draft.playbookId === p.id && "bg-accent/10 border-accent/50 text-text")}
                  >
                    {i < 9 && <span className="mono text-text-mute">{i + 1}</span>}{p.name}
                  </button>
                ))}
                <button type="button" onClick={() => pickPlaybook(null)} className={cn("btn-ghost px-2.5 py-1.5 text-xs", draft.playbookId == null && "bg-surface-2 text-text")}>
                  <span className="mono text-text-mute mr-1.5">0</span>{REVIEW.NO_PLAYBOOK}
                </button>
              </div>
            </div>

            {rules && (
              <div className="flex flex-col gap-1.5">
                <span className="label-caps">{REVIEW.CHECKLIST}</span>
                {rules.entry.length === 0 ? (
                  <span className="text-sm text-text-mute">{REVIEW.NO_CHECKLIST}</span>
                ) : rules.entry.map(c => {
                  const on = draft.followedRules?.includes(c.id) ?? false
                  return (
                    <label key={c.id} className="flex items-center gap-2.5 text-sm text-text cursor-pointer">
                      <input
                        type="checkbox" checked={on} className="accent-accent"
                        onChange={() => patch({ followedRules: toggleFollowed(draft.followedRules, c.id) })}
                      />
                      {c.text}
                      {c.required && <span className="text-xs text-text-mute">{REVIEW.REQUIRED}</span>}
                    </label>
                  )
                })}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="label-caps">{REVIEW.MISTAKES}</span>
              <div className="flex flex-wrap gap-1.5">
                {MISTAKE_PRESETS.map(m => {
                  const on = draft.mistakes.includes(m)
                  return (
                    <button
                      key={m} type="button"
                      onClick={() => patch({ mistakes: on ? draft.mistakes.filter(x => x !== m) : [...draft.mistakes, m] })}
                      className={cn("btn-ghost px-2.5 py-1 text-xs", on && "bg-loss/10 border-loss/40 text-loss")}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="label-caps">{REVIEW.BREAK_EVEN}</span>
              <BeOverrideToggle key={selected.id} tradeId={selected.id} breakEven={selected.breakEven} beOverride={selected.beOverride} />
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="label-caps">{REVIEW.NOTES}</span>
              <textarea
                ref={notesRef} value={draft.notes} rows={3} maxLength={5000}
                onChange={e => patch({ notes: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save() } }}
                placeholder={REVIEW.NOTES_PLACEHOLDER}
                className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi resize-y"
              />
            </label>

            <div className="flex items-center gap-3">
              <span className="text-xs text-text-mute">{REVIEW.KEYS}</span>
              <button type="button" onClick={save} disabled={pending} className="btn-accent ml-auto inline-flex items-center gap-2 disabled:opacity-60">
                {pending && <Spinner />}{REVIEW.SAVE_NEXT}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
