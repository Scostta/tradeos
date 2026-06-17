"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import type { ReactElement, ReactNode } from "react"
import { Button } from "~/lib/ui/button"
import { XIcon } from "~/lib/ui/icons/x-icon"

type Props = {
  label:    string
  title:    string
  count:    number
  children: ReactNode
}

/**
 * Mobile-first filter launcher: a compact button (with an active-count badge)
 * that opens a bottom-sheet/modal holding the filter controls. Used to keep the
 * filter pills from eating vertical space on narrow screens.
 */
export function FilterSheet({ label, title, count, children }: Props): ReactElement {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-md text-xs text-text-dim border border-border hover:border-border-hi transition-colors cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {label}
        {count > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-xxs font-semibold bg-accent"
            style={{ color: "#0a0a0f" }}
          >
            {count}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card border-border-hi w-full sm:max-w-md flex flex-col gap-4 p-5 rounded-b-none sm:rounded-md"
            style={{ maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text">{title}</h2>
              <Button variant="icon" onClick={() => setOpen(false)} className="shrink-0">
                <XIcon />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {children}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
