"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ReactElement } from "react"
import { ChevronDownIcon } from "~/lib/ui/icons/chevron-down-icon"

type Option = {
  value: string | null
  label: string
}

type Props = {
  label:    string
  paramKey: string
  value:    string | null
  options:  Option[]
}

export function FilterPill(props: Props): ReactElement {
  const { label, paramKey, value, options } = props

  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)
  const router          = useRouter()
  const searchParams    = useSearchParams()

  const selectedOption = options.find(o => o.value === value) ?? null

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [])

  function select(optionValue: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (optionValue !== null) {
      params.set(paramKey, optionValue)
    } else {
      params.delete(paramKey)
    }
    params.delete("page")
    router.push(`?${params.toString()}`)
    setOpen(false)
  }

  const buttonLabel = selectedOption && selectedOption.value !== null
    ? `${label}: ${selectedOption.label}`
    : label

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:      "inline-flex",
          alignItems:   "center",
          gap:          6,
          height:       30,
          padding:      "0 10px",
          background:   "var(--color-surface)",
          border:       `1px solid ${open ? "var(--color-border-hi)" : "var(--color-border)"}`,
          borderRadius: 6,
          color:        value !== null ? "var(--color-text)" : "var(--color-text-dim)",
          fontFamily:   "inherit",
          fontSize:     12,
          cursor:       "pointer",
          whiteSpace:   "nowrap",
          transition:   "border-color 0.15s",
        }}
      >
        {buttonLabel}
        <span
          style={{
            color:      "var(--color-text-mute)",
            transform:  open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            display:    "flex",
          }}
        >
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div
          style={{
            position:     "absolute",
            top:          "calc(100% + 4px)",
            left:         0,
            minWidth:     "100%",
            background:   "var(--color-surface)",
            border:       "1px solid var(--color-border-hi)",
            borderRadius: 6,
            padding:      "3px 0",
            zIndex:       50,
            boxShadow:    "0 8px 24px rgba(0,0,0,.45)",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value ?? "__null__"}
              onClick={() => select(opt.value)}
              style={{
                display:    "flex",
                alignItems: "center",
                width:      "100%",
                padding:    "6px 12px",
                background: opt.value === value ? "var(--color-surface-2)" : "transparent",
                border:     "none",
                color:      opt.value === value ? "var(--color-text)" : "var(--color-text-dim)",
                fontFamily: "inherit",
                fontSize:   13,
                cursor:     "pointer",
                textAlign:  "left",
                whiteSpace: "nowrap",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
