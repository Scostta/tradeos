"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import type { ReactElement } from "react"
import { saveThesisDraft } from "~/actions/invest"
import { draftThesisWithAi } from "~/actions/invest-ai"
import { INVEST } from "~/constants/copies/invest"
import { THESIS_PROMPT_KEYS } from "~/types/invest"
import type { ThesisAnswers, ThesisPromptKey } from "~/types/invest"
import { cn } from "~/utils/cn"
import { INPUT_CLS } from "~/lib/ui/form"
import { Spinner } from "~/lib/ui/spinner"
import { SparklesIcon } from "~/lib/ui/icons/sparkles-icon"
import { investErrorMessage } from "../../components/invest-errors"
import { useThesisDraft } from "./thesis-draft-context.client"

const D = INVEST.DETAIL
const AUTOSAVE_MS = 1500

type Status = "idle" | "dirty" | "saving" | "saved" | "error"

// Autoguardado (§4.7): 1,5 s después de dejar de escribir y al salir de un campo.
// Las respuestas viven en ThesisDraftProvider (las lee también el botón Open).
// "Draft with AI" (§4.8) rellena las vacías; si ya hay texto, pregunta antes de sustituir.
export function ThesisPrompts({ ticker, initial, aiEnabled }: { ticker: string; initial: ThesisAnswers; aiEnabled: boolean }): ReactElement {
  const { answers: shared, setAnswers } = useThesisDraft()
  const answers = shared ?? initial
  const [status, setStatus] = useState<Status>("idle")
  const [, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(answers)
  const [ai, setAi] = useState<{ state: "idle" | "loading" } | { state: "choose"; draft: ThesisAnswers } | { state: "error"; message: string }>({ state: "idle" })

  function save() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setStatus("saving")
    const snapshot = latest.current
    startTransition(async () => {
      const result = await saveThesisDraft({ ticker, answers: snapshot })
      // Si se siguió escribiendo mientras guardaba, queda "dirty" y se reprograma.
      if (latest.current !== snapshot) return
      setStatus(result.success ? "saved" : "error")
    })
  }

  function change(key: ThesisPromptKey, value: string) {
    const next = { ...latest.current, [key]: value }
    latest.current = next
    setAnswers(next)
    setStatus("dirty")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, AUTOSAVE_MS)
  }

  /** Aplica respuestas de la IA y guarda al momento. */
  function apply(next: ThesisAnswers) {
    latest.current = next
    setAnswers(next)
    setAi({ state: "idle" })
    save()
  }

  async function draftWithAi() {
    setAi({ state: "loading" })
    const res = await draftThesisWithAi({ ticker })
    if (!res.success) { setAi({ state: "error", message: investErrorMessage(res.error) }); return }
    const hasText = THESIS_PROMPT_KEYS.some(k => latest.current[k].trim())
    if (hasText) setAi({ state: "choose", draft: res.data.answers })
    else apply(res.data.answers)
  }

  function fillEmpty(draft: ThesisAnswers) {
    const cur = latest.current
    apply(Object.fromEntries(THESIS_PROMPT_KEYS.map(k => [k, cur[k].trim() ? cur[k] : draft[k]])) as ThesisAnswers)
  }

  function blur() {
    if (status === "dirty") save()
  }

  // Al salir de la página con cambios pendientes, avisa (el navegador decide el texto).
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (timer.current) e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-text-mute">{D.PROMPTS_HINT}</p>
        {aiEnabled && (
          <button
            type="button" onClick={() => void draftWithAi()} disabled={ai.state === "loading"}
            className="btn-ghost inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60"
          >
            {ai.state === "loading" ? <Spinner size={10} /> : <SparklesIcon width={14} height={14} className="text-accent" />}
            {ai.state === "loading" ? D.AI_DRAFTING : D.AI_DRAFT}
          </button>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0",
            status === "error" ? "text-loss" : status === "saved" ? "text-profit" : "text-text-mute",
          )}
          aria-live="polite"
        >
          {status === "saving" && <><Spinner size={10} />{D.SAVING}</>}
          {status === "saved" && D.SAVED}
          {status === "error" && D.SAVE_ERROR}
        </span>
      </div>
      {ai.state === "error" && <p className="text-sm text-loss">{ai.message}</p>}
      {ai.state === "choose" && (
        <div className="rounded-md border border-accent/25 bg-accent/5 px-3 py-2.5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-dim">{D.AI_CHOOSE}</span>
          <button type="button" onClick={() => fillEmpty(ai.draft)} className="btn-ghost px-2.5 py-1 text-xs">{D.AI_FILL_EMPTY}</button>
          <button type="button" onClick={() => apply(ai.draft)} className="btn-ghost px-2.5 py-1 text-xs text-short border-short/40">{D.AI_REPLACE}</button>
          <button type="button" onClick={() => setAi({ state: "idle" })} className="text-xs text-text-mute hover:text-text-dim cursor-pointer">{D.AI_CANCEL}</button>
        </div>
      )}
      {aiEnabled && <p className="text-xs text-text-mute">{D.AI_DISCLAIMER}</p>}
      {THESIS_PROMPT_KEYS.map((key, i) => (
        <label key={key} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">
            <span className="mono text-text-mute mr-2">{i + 1}</span>
            {D.PROMPTS[key]}
          </span>
          <textarea
            value={answers[key]}
            onChange={e => change(key, e.target.value)}
            onBlur={blur}
            rows={3}
            maxLength={5000}
            className={`${INPUT_CLS} resize-y`}
          />
        </label>
      ))}
    </div>
  )
}
