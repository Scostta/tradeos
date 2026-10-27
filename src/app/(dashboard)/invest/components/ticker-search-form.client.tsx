"use client"

import { useState, useTransition } from "react"
import type { FormEvent, ReactElement } from "react"
import { useRouter } from "next/navigation"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import { Spinner } from "./spinner"

// El resultado se pinta en servidor (?q=TICKER); la transición mantiene el
// botón en "Checking" hasta que llega la nueva página.
export function TickerSearchForm({ initial }: { initial: string }): ReactElement {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [pending, startTransition] = useTransition()

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = value.trim().toUpperCase()
    if (!q || pending) return
    startTransition(() => {
      router.push(`${APP_URLS.INVEST}?tab=screen&q=${encodeURIComponent(q)}`, { scroll: false })
    })
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 w-full md:w-auto">
      <div className="relative flex-1 md:flex-none">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-mute pointer-events-none"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          name="q"
          value={value}
          onChange={e => setValue(e.target.value.toUpperCase())}
          placeholder={INVEST.SCREEN.SEARCH_PLACEHOLDER}
          autoComplete="off"
          spellCheck={false}
          className="mono bg-surface-2 border border-border rounded-sm pl-8 pr-2.5 py-2 text-base text-text w-full md:w-60 outline-none focus:border-border-hi"
        />
      </div>
      <button
        type="submit"
        disabled={pending || value.trim() === ""}
        className="btn-accent inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ minWidth: 96 }}
      >
        {pending ? (
          <>
            <Spinner />
            {INVEST.SCREEN.SEARCH_LOADING}
          </>
        ) : (
          INVEST.SCREEN.SEARCH_CTA
        )}
      </button>
    </form>
  )
}
