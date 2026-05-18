"use client"

import type { ReactElement } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { RangeKey } from "~/types/metrics"
import { DASHBOARD } from "~/constants/copies/dashboard"

type Props = { value: RangeKey }

const OPTIONS: { id: RangeKey; label: string }[] = [
  { id: "today", label: DASHBOARD.RANGE.TODAY },
  { id: "week",  label: DASHBOARD.RANGE.WEEK  },
  { id: "month", label: DASHBOARD.RANGE.MONTH },
  { id: "ytd",   label: DASHBOARD.RANGE.YTD   },
]

export function RangeSelector({ value }: Props): ReactElement {
  const router     = useRouter()
  const searchParams = useSearchParams()

  function onChange(id: RangeKey) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("range", id)
    router.push(`?${params.toString()}`)
  }

  return (
    <div
      className="inline-flex items-stretch border border-border rounded overflow-hidden bg-surface"
    >
      {OPTIONS.map((o, i) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className="relative px-3 py-1.5 text-base transition-colors whitespace-nowrap"
            style={{
              background:  active ? "var(--color-surface-2)" : "transparent",
              color:       active ? "var(--color-text)"      : "var(--color-text-dim)",
              border:      "none",
              borderLeft:  i > 0 ? "1px solid var(--color-border)" : "none",
              fontFamily:  "inherit",
              fontWeight:  active ? 500 : 400,
              cursor:      "pointer",
            }}
          >
            {active && (
              <span
                className="absolute inset-x-0 top-0 h-0.5"
                style={{ background: "var(--color-accent)" }}
              />
            )}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
