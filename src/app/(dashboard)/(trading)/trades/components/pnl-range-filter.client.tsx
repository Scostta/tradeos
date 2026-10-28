"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ReactElement } from "react"
import { ChevronDownIcon } from "~/lib/ui/icons/chevron-down-icon"
import { TRADES } from "~/constants/copies/trades"

type Props = { min: number | null; max: number | null }

const INPUT_STYLE = "bg-surface-2 border border-border rounded-sm px-2 py-1.5 text-sm text-text w-24 outline-none focus:border-border-hi"

export function PnlRangeFilter({ min, max }: Props): ReactElement {
  const [open, setOpen]       = useState(false)
  const [minDraft, setMin]    = useState(min !== null ? String(min) : "")
  const [maxDraft, setMax]    = useState(max !== null ? String(max) : "")
  const ref                   = useRef<HTMLDivElement>(null)
  const router                = useRouter()
  const searchParams          = useSearchParams()

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [])

  const active = min !== null || max !== null

  function commit(nextMin: string, nextMax: string) {
    const params = new URLSearchParams(searchParams.toString())
    const setOrDel = (key: string, raw: string) => {
      const n = parseFloat(raw)
      if (raw.trim() !== "" && Number.isFinite(n)) params.set(key, String(n))
      else params.delete(key)
    }
    setOrDel("pnlMin", nextMin)
    setOrDel("pnlMax", nextMax)
    params.delete("page")
    router.push(`?${params.toString()}`)
    setOpen(false)
  }

  function clear() {
    setMin("")
    setMax("")
    commit("", "")
  }

  const buttonLabel = active
    ? `${TRADES.LIST.FILTERS.PNL}: ${min ?? "−∞"}…${max ?? "∞"}`
    : TRADES.LIST.FILTERS.PNL

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px",
          background: "var(--color-surface)",
          border: `1px solid ${open ? "var(--color-border-hi)" : "var(--color-border)"}`,
          borderRadius: 6, color: active ? "var(--color-text)" : "var(--color-text-dim)",
          fontFamily: "inherit", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "border-color 0.15s",
        }}
      >
        {buttonLabel}
        <span style={{ color: "var(--color-text-mute)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "flex" }}>
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div
          className="flex flex-col gap-2"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0,
            background: "var(--color-surface)", border: "1px solid var(--color-border-hi)",
            borderRadius: 6, padding: 10, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,.45)",
          }}
        >
          <div className="flex items-center gap-2">
            <input
              type="number" inputMode="decimal" value={minDraft}
              onChange={(e) => setMin(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commit(minDraft, maxDraft) }}
              placeholder={TRADES.LIST.FILTERS.PNL_MIN}
              className={INPUT_STYLE}
            />
            <span className="text-text-mute text-sm">–</span>
            <input
              type="number" inputMode="decimal" value={maxDraft}
              onChange={(e) => setMax(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commit(minDraft, maxDraft) }}
              placeholder={TRADES.LIST.FILTERS.PNL_MAX}
              className={INPUT_STYLE}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={clear}
              className="text-xs text-text-mute hover:text-text-dim transition-colors cursor-pointer"
            >
              {TRADES.LIST.FILTERS.CLEAR}
            </button>
            <button
              type="button"
              onClick={() => commit(minDraft, maxDraft)}
              className="btn-accent text-xs"
            >
              {TRADES.LIST.FILTERS.APPLY}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
