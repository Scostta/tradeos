"use client"

import type { ReactElement } from "react"
import { JOURNAL } from "~/constants/copies/journal"
import { cn } from "~/utils/cn"

// Ánimo del día (1–5) con las etiquetas y colores del Journal. Lo usan el
// drawer del Journal y el cierre del día de /review; volver a pulsar el
// seleccionado lo quita.
export function MoodPicker({ value, onChange, className }: {
  value:      number | null
  onChange:   (mood: number | null) => void
  className?: string
}): ReactElement {
  return (
    <div className={cn("grid grid-cols-5 gap-1.5", className)} role="radiogroup">
      {JOURNAL.MOODS.map(m => (
        <button
          key={m.v}
          type="button"
          role="radio"
          aria-checked={value === m.v}
          onClick={() => onChange(value === m.v ? null : m.v)}
          className={cn(
            "flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-sm border transition-colors cursor-pointer",
            value === m.v ? "border-accent bg-surface-2" : "border-border hover:border-border-hi",
          )}
        >
          <span
            className="rounded-full block"
            style={{
              width: 10,
              height: 10,
              background: value === m.v ? m.color : "var(--color-border-hi)",
              transition: "background 0.15s",
            }}
          />
          <span className="label-caps">{m.label}</span>
        </button>
      ))}
    </div>
  )
}
