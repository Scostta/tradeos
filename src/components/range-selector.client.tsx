"use client"

import { useRouter, useSearchParams } from "next/navigation"
import type { ReactElement } from "react"

export type RangeOption = {
  id:    string
  label: string
}

type Props = {
  value:   string
  options: readonly RangeOption[]
}

export function RangeSelector({ value, options }: Props): ReactElement {
  const router       = useRouter()
  const searchParams = useSearchParams()

  function select(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (id === "all") {
      params.delete("range")
    } else {
      params.set("range", id)
    }
    params.delete("page")
    router.push(`?${params.toString()}`)
  }

  return (
    <div
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        background:   "var(--color-surface)",
        border:       "1px solid var(--color-border)",
        borderRadius: 6,
        overflow:     "hidden",
      }}
    >
      {options.map((opt, i) => {
        const isActive = opt.id === value
        return (
          <button
            key={opt.id}
            onClick={() => select(opt.id)}
            style={{
              height:      30,
              padding:     "0 10px",
              background:  isActive ? "var(--color-surface-2)" : "transparent",
              border:      "none",
              borderLeft:  i === 0 ? "none" : "1px solid var(--color-border)",
              borderTop:   isActive ? "1px solid var(--color-accent)" : "1px solid transparent",
              color:       isActive ? "var(--color-text)" : "var(--color-text-mute)",
              fontFamily:  "inherit",
              fontSize:    12,
              cursor:      "pointer",
              whiteSpace:  "nowrap",
              transition:  "background 0.15s, color 0.15s",
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
