"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { setFalsifierStatus } from "~/actions/invest"
import { INVEST } from "~/constants/copies/invest"
import { Toast } from "~/lib/ui/toast"
import type { FalsifierStatus } from "~/types/invest"
import { cn } from "~/utils/cn"
import { investErrorMessage } from "../../../components/invest-errors"

const P = INVEST.POSITIONS
const D = INVEST.POSITION
const OPTIONS: { value: FalsifierStatus; label: string }[] = [
  { value: "ok",     label: D.STATUS_OK },
  { value: "review", label: D.STATUS_REVIEW },
]

type Props = {
  positionId: string
  thesis:     string
  falsifiers: string[]
  status:     FalsifierStatus[]   // alineado con falsifiers; lo que falta es "ok"
  editable:   boolean             // solo posiciones abiertas
}

// §4.3: estado manual de cada falsador (sin novedad / revisar). Es una nota
// para el usuario; no cambia la salida, que sigue siendo la regla mensual.
export function ThesisFalsifiers({ positionId, thesis, falsifiers, status, editable }: Props): ReactElement {
  const [current, setCurrent] = useState<FalsifierStatus[]>(() => falsifiers.map((_, i) => status[i] ?? "ok"))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function change(index: number, value: FalsifierStatus) {
    if (current[index] === value || pending) return
    const previous = current
    setCurrent(list => list.map((s, i) => (i === index ? value : s)))
    startTransition(async () => {
      const result = await setFalsifierStatus({ positionId, index, status: value })
      if (!result.success) {
        setCurrent(previous)
        setError(investErrorMessage(result.error))
        setTimeout(() => setError(null), 5000)
      }
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-4">
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant="error" message={error} />
        </div>
      )}
      <div className="min-w-0">
        <span className="label-caps">{P.THESIS}</span>
        <p className="text-sm text-text-dim mt-1.5 whitespace-pre-wrap">{thesis}</p>
      </div>
      <div className="min-w-0 flex flex-col gap-2">
        <span className="label-caps">{P.FALSIFIERS}</span>
        <ol className="flex flex-col gap-2.5">
          {falsifiers.map((f, i) => {
            const review = current[i] === "review"
            return (
              <li
                key={i}
                className={cn(
                  "flex flex-col gap-2 rounded-md border px-3 py-2.5",
                  review ? "border-short/40 bg-short/5" : "border-border",
                )}
              >
                <div className="flex gap-2 text-sm text-text-dim">
                  <span className="mono text-xs text-text-mute mt-px">{i + 1}</span>
                  <span className="min-w-0">{f}</span>
                </div>
                {editable ? (
                  <div role="radiogroup" aria-label={`${P.FALSIFIERS} ${i + 1}`} className="flex gap-1 self-start">
                    {OPTIONS.map(o => {
                      const active = current[i] === o.value
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => change(i, o.value)}
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-sm border transition-colors cursor-pointer",
                            active && o.value === "review" && "border-short/50 bg-short/10 text-short",
                            active && o.value === "ok" && "border-border-hi bg-surface-2 text-text",
                            !active && "border-border text-text-mute hover:text-text-dim",
                          )}
                        >
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  review && <span className="self-start text-xs px-2 py-0.5 rounded-sm bg-short/10 text-short">{D.STATUS_REVIEW}</span>
                )}
              </li>
            )
          })}
        </ol>
        {editable && <p className="text-xs text-text-mute">{D.STATUS_HINT}</p>}
      </div>
    </div>
  )
}
