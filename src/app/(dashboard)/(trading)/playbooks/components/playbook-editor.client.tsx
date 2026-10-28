"use client"

import { useState, useTransition } from "react"
import { createPortal } from "react-dom"
import type { ReactElement } from "react"
import type { PlaybookWithStats } from "~/types/playbook"
import { createPlaybook, updatePlaybook, setPlaybookActive } from "~/actions/playbooks"
import { PLAYBOOKS } from "~/constants/copies/playbooks"
import { cn } from "~/utils/cn"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import { XIcon } from "~/lib/ui/icons/x-icon"
import { GRADE_SCALE } from "~/constants/grades"
import {
  parsePlaybookRules, serializePlaybookRules, withEntry, setGradeMin, confirmationCount, EMPTY_RULES,
} from "~/helpers/playbook-rules"
import type { PlaybookRules, RuleGroup } from "~/helpers/playbook-rules"

type ToastState = { message: string; variant: ToastVariant }

const newId = (): string => crypto.randomUUID()

function initialRules(raw: string | null): PlaybookRules {
  const parsed = parsePlaybookRules(raw)
  if (!raw || parsed.all.length > 0) return parsed
  try {
    const p = JSON.parse(raw) as unknown
    if (p && typeof p === "object" && !Array.isArray(p)) return EMPTY_RULES
  } catch { /* legacy plain-text rules */ }
  // Legacy free-text rules become a single entry criterion.
  return withEntry(EMPTY_RULES, [{ id: newId(), text: raw, required: false }])
}

type Props =
  | { mode: "create"; renderTrigger?: (open: () => void) => ReactElement }
  | { mode: "edit"; playbook: PlaybookWithStats; renderTrigger?: (open: () => void) => ReactElement }

export function PlaybookEditor(props: Props): ReactElement {
  const [isOpen, setIsOpen]             = useState(false)
  const [name, setName]                 = useState("")
  const [description, setDescription]  = useState("")
  const [rules, setRules]               = useState<PlaybookRules>(EMPTY_RULES)
  const [archiveArmed, setArchiveArmed] = useState(false)
  const [toast, setToast]               = useState<ToastState | null>(null)
  const [isPending, startTransition]    = useTransition()

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 4000)
  }

  function openModal() {
    if (props.mode === "edit") {
      setName(props.playbook.name)
      setDescription(props.playbook.description ?? "")
      setRules(initialRules(props.playbook.rules))
    } else {
      setName("")
      setDescription("")
      setRules(EMPTY_RULES)
    }
    setArchiveArmed(false)
    setIsOpen(true)
  }

  function closeModal() {
    setIsOpen(false)
    setArchiveArmed(false)
  }

  // Criteria keep their id across edits: trades reference criteria by id, so
  // renaming one never un-ticks it on past trades.
  function addRule(section: RuleGroup) {
    setRules(prev => section === "entry"
      ? withEntry(prev, [...prev.entry, { id: newId(), text: "", required: false }])
      : { ...prev, [section]: [...prev[section], { id: newId(), text: "" }] })
  }

  function setMin(section: "exit" | "conditions", value: number) {
    setRules(prev => ({ ...prev, min: { ...prev.min, [section]: value } }))
  }

  function updateRule(section: RuleGroup, idx: number, text: string) {
    setRules(prev => section === "entry"
      ? { ...prev, entry: prev.entry.map((c, i) => i === idx ? { ...c, text } : c) }
      : { ...prev, [section]: prev[section].map((c, i) => i === idx ? { ...c, text } : c) })
  }

  // Removing a confirmation or marking a criterion required lowers the number of
  // confirmations; withEntry clips the grade thresholds to the new maximum.
  function removeRule(section: RuleGroup, idx: number) {
    setRules(prev => section === "entry"
      ? withEntry(prev, prev.entry.filter((_, i) => i !== idx))
      : { ...prev, [section]: prev[section].filter((_, i) => i !== idx) })
  }

  function toggleRequired(idx: number) {
    setRules(prev => withEntry(prev, prev.entry.map((c, i) => i === idx ? { ...c, required: !c.required } : c)))
  }

  function setThreshold(gradeId: string, value: number) {
    setRules(prev => ({ ...prev, gradeMin: setGradeMin(prev.gradeMin, gradeId, value, confirmationCount(prev.entry)) }))
  }

  function handleSave() {
    startTransition(async () => {
      const input = {
        name:        name.trim(),
        description: description.trim() || null,
        rules:       serializePlaybookRules(rules),
      }
      const result =
        props.mode === "create"
          ? await createPlaybook(input)
          : await updatePlaybook({ id: props.playbook.id, ...input })

      if (result.success) {
        showToast(
          props.mode === "create" ? PLAYBOOKS.TOAST.CREATE_SUCCESS : PLAYBOOKS.TOAST.SAVE_SUCCESS,
          "success",
        )
        closeModal()
      } else {
        showToast(PLAYBOOKS.TOAST.ERROR, "error")
      }
    })
  }

  function handleArchiveClick() {
    if (props.mode !== "edit") return
    if (!archiveArmed) { setArchiveArmed(true); return }
    startTransition(async () => {
      if (props.mode !== "edit") return
      const result = await setPlaybookActive({ id: props.playbook.id, active: false })
      if (result.success) { showToast(PLAYBOOKS.TOAST.ARCHIVED, "success"); closeModal() }
      else showToast(PLAYBOOKS.TOAST.ERROR, "error")
    })
  }

  function handleRestore() {
    if (props.mode !== "edit") return
    startTransition(async () => {
      if (props.mode !== "edit") return
      const result = await setPlaybookActive({ id: props.playbook.id, active: true })
      if (result.success) { showToast(PLAYBOOKS.TOAST.RESTORED, "success"); closeModal() }
      else showToast(PLAYBOOKS.TOAST.ERROR, "error")
    })
  }

  const title      = props.mode === "create" ? PLAYBOOKS.EDITOR.CREATE_TITLE : PLAYBOOKS.EDITOR.EDIT_TITLE
  const saveLabel  = props.mode === "create" ? PLAYBOOKS.EDITOR.CREATE       : PLAYBOOKS.EDITOR.SAVE
  const isSaveDisabled = name.trim() === "" || isPending

  const defaultTrigger = props.mode === "edit"
    ? <Button variant="ghost" onClick={openModal}>{PLAYBOOKS.EDITOR.EDIT_TITLE}</Button>
    : null

  const SECTIONS: { key: RuleGroup; label: string }[] = [
    { key: "entry",      label: PLAYBOOKS.EDITOR.ENTRY_CRITERIA    },
    { key: "exit",       label: PLAYBOOKS.EDITOR.EXIT_CRITERIA     },
    { key: "conditions", label: PLAYBOOKS.EDITOR.MARKET_CONDITIONS },
  ]
  const confirmations = confirmationCount(rules.entry)
  const gradedScale   = GRADE_SCALE.slice(1).reverse()   // best first, lowest grade has no threshold
  const lowest        = GRADE_SCALE[0]
  const lowestHint    = `${lowest.label} = ${PLAYBOOKS.EDITOR.LOWEST_HINT_BELOW} ${GRADE_SCALE[1].label} ${PLAYBOOKS.EDITOR.LOWEST_HINT_OR} ${PLAYBOOKS.EDITOR.LOWEST_HINT_MISSING}`

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      {props.renderTrigger ? props.renderTrigger(openModal) : defaultTrigger}

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="card border-border-hi w-full flex flex-col"
            style={{ maxWidth: 560, maxHeight: "90vh", boxShadow: "0 20px 80px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-6 pb-4 shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-text">{title}</h2>
                <span className="label-caps mt-0.5 block">{PLAYBOOKS.EDITOR.CAPTION}</span>
              </div>
              <Button variant="icon" onClick={closeModal} className="shrink-0">
                <XIcon />
              </Button>
            </div>

            {/* Scrollable body */}
            <div className="flex flex-col gap-5 px-6 pb-4 overflow-y-auto">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="label-caps">{PLAYBOOKS.EDITOR.NAME_LABEL}</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={PLAYBOOKS.EDITOR.NAME_PLACEHOLDER}
                  className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="label-caps">{PLAYBOOKS.EDITOR.DESCRIPTION_LABEL}</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={PLAYBOOKS.EDITOR.DESCRIPTION_PLACEHOLDER}
                  className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi resize-none"
                />
              </div>

              {/* Rules — three sections */}
              {SECTIONS.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text">{label}</span>
                    {key !== "entry" && rules[key].length > 0 && (
                      <label className="flex items-center gap-1.5 text-xxs text-text-mute">
                        {PLAYBOOKS.EDITOR.MIN_LABEL}
                        <select
                          value={Math.min(rules.min[key], rules[key].length)}
                          onChange={e => setMin(key, Number(e.target.value))}
                          className="bg-surface-2 border border-border rounded-xs px-1 py-0.5 text-xs text-text outline-none focus:border-border-hi cursor-pointer"
                        >
                          {Array.from({ length: rules[key].length + 1 }, (_, n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        {PLAYBOOKS.EDITOR.MIN_OF} {rules[key].length}
                      </label>
                    )}
                  </div>

                  {rules[key].length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {key === "entry" && (
                        <span className="text-xxs text-text-mute">{PLAYBOOKS.EDITOR.REQUIRED_HINT}</span>
                      )}
                      {rules[key].map((rule, idx) => (
                        <div key={rule.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={rule.text}
                            onChange={e => updateRule(key, idx, e.target.value)}
                            placeholder={PLAYBOOKS.EDITOR.RULE_PLACEHOLDER}
                            className="flex-1 bg-surface-2 border border-border rounded-sm px-2.5 py-1.5 text-sm text-text outline-none focus:border-border-hi"
                          />
                          {key === "entry" && (
                            <button
                              type="button"
                              onClick={() => toggleRequired(idx)}
                              aria-pressed={rules.entry[idx]!.required}
                              className={cn(
                                "shrink-0 text-xxs mono uppercase tracking-wider rounded-xs px-1.5 py-1 border transition-colors cursor-pointer",
                                rules.entry[idx]!.required
                                  ? "text-short border-short/50 bg-short/10"
                                  : "text-text-mute border-border hover:text-text-dim hover:border-border-hi",
                              )}
                            >
                              {PLAYBOOKS.EDITOR.REQUIRED}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeRule(key, idx)}
                            className="shrink-0 text-text-mute hover:text-loss transition-colors"
                            style={{ lineHeight: 1 }}
                          >
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => addRule(key)}
                    className="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer"
                  >
                    {PLAYBOOKS.EDITOR.ADD_RULE}
                  </button>

                  {/* Grade thresholds — entry only, over the confirmations */}
                  {key === "entry" && rules.entry.length > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-sm border border-border p-2.5">
                      <span className="label-caps">{PLAYBOOKS.EDITOR.THRESHOLDS}</span>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        {gradedScale.map(g => (
                          <label key={g.id} className="flex items-center gap-1.5 text-xs text-text-mute">
                            <span className="mono font-semibold" style={{ color: g.color }}>{g.label}</span>
                            ≥
                            <select
                              value={rules.gradeMin[g.id] ?? confirmations}
                              onChange={e => setThreshold(g.id, Number(e.target.value))}
                              className="bg-surface-2 border border-border rounded-xs px-1 py-0.5 text-xs text-text outline-none focus:border-border-hi cursor-pointer"
                            >
                              {Array.from({ length: confirmations + 1 }, (_, n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                            {PLAYBOOKS.EDITOR.MIN_OF} {confirmations} {PLAYBOOKS.EDITOR.CONFIRMATIONS}
                          </label>
                        ))}
                      </div>
                      <span className="text-xxs text-text-mute">{lowestHint}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
              {props.mode === "edit" ? (
                props.playbook.active ? (
                  <button
                    type="button"
                    onClick={handleArchiveClick}
                    disabled={isPending}
                    className={cn(
                      "text-xs text-text-mute hover:text-loss transition-colors disabled:opacity-60 cursor-pointer",
                      archiveArmed && "text-loss",
                    )}
                  >
                    {archiveArmed ? PLAYBOOKS.EDITOR.ARCHIVE_CONFIRM : PLAYBOOKS.EDITOR.ARCHIVE}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={isPending}
                    className="text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {PLAYBOOKS.EDITOR.RESTORE}
                  </button>
                )
              ) : <span />}

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={closeModal} disabled={isPending}>
                  {PLAYBOOKS.EDITOR.CANCEL}
                </Button>
                <Button variant="accent" onClick={handleSave} disabled={isSaveDisabled} loading={isPending}>
                  {saveLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
