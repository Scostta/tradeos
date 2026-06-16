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

type ToastState  = { message: string; variant: ToastVariant }
type RulesState  = { entry: string[]; exit: string[]; conditions: string[] }
type RulesSection = keyof RulesState

function parseRules(raw: string | null): RulesState {
  if (!raw) return { entry: [], exit: [], conditions: [] }
  try {
    const p = JSON.parse(raw) as unknown
    if (p && typeof p === "object" && !Array.isArray(p)) {
      const obj = p as Record<string, unknown>
      return {
        entry:      Array.isArray(obj["entry"])      ? (obj["entry"] as string[])      : [],
        exit:       Array.isArray(obj["exit"])        ? (obj["exit"] as string[])       : [],
        conditions: Array.isArray(obj["conditions"]) ? (obj["conditions"] as string[]) : [],
      }
    }
  } catch { /* legacy plain-text rules */ }
  return { entry: [raw], exit: [], conditions: [] }
}

function serializeRules(r: RulesState): string | null {
  const clean = {
    entry:      r.entry.filter(x => x.trim()),
    exit:       r.exit.filter(x => x.trim()),
    conditions: r.conditions.filter(x => x.trim()),
  }
  if (!clean.entry.length && !clean.exit.length && !clean.conditions.length) return null
  return JSON.stringify(clean)
}

type Props =
  | { mode: "create"; renderTrigger?: (open: () => void) => ReactElement }
  | { mode: "edit"; playbook: PlaybookWithStats; renderTrigger?: (open: () => void) => ReactElement }

export function PlaybookEditor(props: Props): ReactElement {
  const [isOpen, setIsOpen]             = useState(false)
  const [name, setName]                 = useState("")
  const [description, setDescription]  = useState("")
  const [rules, setRules]               = useState<RulesState>({ entry: [], exit: [], conditions: [] })
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
      setRules(parseRules(props.playbook.rules))
    } else {
      setName("")
      setDescription("")
      setRules({ entry: [], exit: [], conditions: [] })
    }
    setArchiveArmed(false)
    setIsOpen(true)
  }

  function closeModal() {
    setIsOpen(false)
    setArchiveArmed(false)
  }

  function addRule(section: RulesSection) {
    setRules(prev => ({ ...prev, [section]: [...prev[section], ""] }))
  }

  function updateRule(section: RulesSection, idx: number, value: string) {
    setRules(prev => {
      const next = [...prev[section]]
      next[idx] = value
      return { ...prev, [section]: next }
    })
  }

  function removeRule(section: RulesSection, idx: number) {
    setRules(prev => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== idx),
    }))
  }

  function handleSave() {
    startTransition(async () => {
      const input = {
        name:        name.trim(),
        description: description.trim() || null,
        rules:       serializeRules(rules),
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

  const SECTIONS: { key: RulesSection; label: string }[] = [
    { key: "entry",      label: PLAYBOOKS.EDITOR.ENTRY_CRITERIA    },
    { key: "exit",       label: PLAYBOOKS.EDITOR.EXIT_CRITERIA     },
    { key: "conditions", label: PLAYBOOKS.EDITOR.MARKET_CONDITIONS },
  ]

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
                  <span className="text-sm font-medium text-text">{label}</span>

                  {rules[key].length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {rules[key].map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={rule}
                            onChange={e => updateRule(key, idx, e.target.value)}
                            placeholder={PLAYBOOKS.EDITOR.RULE_PLACEHOLDER}
                            className="flex-1 bg-surface-2 border border-border rounded-sm px-2.5 py-1.5 text-sm text-text outline-none focus:border-border-hi"
                          />
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
