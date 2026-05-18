"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ReactElement } from "react"
import type { Account } from "~/types"
import { ChevronDownIcon } from "~/lib/ui/icons/chevron-down-icon"

type Props = {
  accounts: Account[]
  value:    string | null
}

export function AccountSelector({ accounts, value }: Props): ReactElement {
  const [open, setOpen]     = useState(false)
  const ref                 = useRef<HTMLDivElement>(null)
  const router              = useRouter()
  const searchParams        = useSearchParams()
  const selected            = accounts.find(a => a.id === value) ?? null

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [])

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (id) params.set("account", id)
    else    params.delete("account")
    router.push(`?${params.toString()}`)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:     "inline-flex",
          alignItems:  "center",
          gap:         7,
          height:      32,
          padding:     "0 10px",
          background:  "var(--color-surface)",
          border:      `1px solid ${open ? "var(--color-border-hi)" : "var(--color-border)"}`,
          borderRadius: 6,
          color:        "var(--color-text)",
          fontFamily:  "inherit",
          fontSize:    13,
          cursor:      "pointer",
          whiteSpace:  "nowrap",
          transition:  "border-color 0.15s",
        }}
      >
        {selected ? (
          <>
            <span
              style={{
                width: 8, height: 8,
                borderRadius: "50%",
                background: selected.color,
                flexShrink: 0,
              }}
            />
            {selected.name}
          </>
        ) : (
          <span style={{ color: "var(--color-text-mute)" }}>All accounts</span>
        )}
        <span
          style={{
            color:     "var(--color-text-mute)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            display:   "flex",
          }}
        >
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div
          style={{
            position:  "absolute",
            top:       "calc(100% + 4px)",
            right:     0,
            minWidth:  "100%",
            background: "var(--color-surface)",
            border:    "1px solid var(--color-border-hi)",
            borderRadius: 6,
            padding:   "3px 0",
            zIndex:    50,
            boxShadow: "0 8px 24px rgba(0,0,0,.45)",
          }}
        >
          <Option
            label="All accounts"
            active={selected === null}
            onSelect={() => select(null)}
          />
          {accounts.map(a => (
            <Option
              key={a.id}
              label={a.name}
              color={a.color}
              active={a.id === value}
              onSelect={() => select(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Option({
  label,
  color,
  active,
  onSelect,
}: {
  label:    string
  color?:   string
  active:   boolean
  onSelect: () => void
}): ReactElement {
  return (
    <button
      onClick={onSelect}
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        8,
        width:      "100%",
        padding:    "6px 12px",
        background: active ? "var(--color-surface-2)" : "transparent",
        border:     "none",
        color:      active ? "var(--color-text)" : "var(--color-text-dim)",
        fontFamily: "inherit",
        fontSize:   13,
        cursor:     "pointer",
        textAlign:  "left",
        whiteSpace: "nowrap",
      }}
    >
      {color ? (
        <span
          style={{
            width: 8, height: 8,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
          }}
        />
      ) : (
        <span style={{ width: 8, flexShrink: 0 }} />
      )}
      {label}
    </button>
  )
}
