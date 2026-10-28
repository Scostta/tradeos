"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import type { ReactElement } from "react"
import { saveThesisDraft } from "~/actions/invest"
import { INVEST } from "~/constants/copies/invest"
import { THESIS_PROMPT_KEYS } from "~/types/invest"
import type { ThesisAnswers, ThesisPromptKey } from "~/types/invest"
import { cn } from "~/utils/cn"
import { INPUT_CLS } from "../../components/settings-form.client"
import { Spinner } from "../../components/spinner"
import { useThesisDraft } from "./thesis-draft-context.client"

const D = INVEST.DETAIL
const AUTOSAVE_MS = 1500

type Status = "idle" | "dirty" | "saving" | "saved" | "error"

// Autoguardado (§4.7): 1,5 s después de dejar de escribir y al salir de un campo.
// Las respuestas viven en ThesisDraftProvider (las lee también el botón Open).
export function ThesisPrompts({ ticker, initial }: { ticker: string; initial: ThesisAnswers }): ReactElement {
  const { answers: shared, setAnswers } = useThesisDraft()
  const answers = shared ?? initial
  const [status, setStatus] = useState<Status>("idle")
  const [, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(answers)

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
