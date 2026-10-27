"use client"

import { useSyncExternalStore } from "react"
import type { ReactElement, ReactNode } from "react"
import { createPortal } from "react-dom"
import { Button } from "~/lib/ui/button"
import { XIcon } from "~/lib/ui/icons/x-icon"

const subscribe = () => () => {}

type Props = {
  title:     string
  caption?:  ReactNode
  width?:    number
  onClose:   () => void
  children:  ReactNode
}

// Mismo aspecto que los modales de /accounts (card + backdrop con blur).
export function Modal({ title, caption, width = 520, onClose, children }: Props): ReactElement | null {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card border-border-hi overflow-y-auto p-6 flex flex-col gap-5"
        style={{ width, maxWidth: "100%", maxHeight: "90vh", boxShadow: "0 20px 80px rgba(0,0,0,0.6)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            {caption && <div className="text-sm text-text-mute mt-0.5">{caption}</div>}
          </div>
          <Button variant="icon" onClick={onClose} className="shrink-0">
            <XIcon />
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
