"use client"

import { useRef, useMemo, useEffect } from "react"
import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"

type Props = {
  files:    File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}

/**
 * Client-side attachment staging for the trade form. Holds File objects (with
 * object-URL previews) until the parent saves — the trade must exist before the
 * files can be uploaded, so the modal uploads them after create/update.
 */
export function AttachmentStaging({ files, onChange, disabled }: Props): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)

  // Object URLs for previews — revoked when files change or on unmount.
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])

  function addFiles(list: FileList | null) {
    if (!list) return
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"))
    if (imgs.length) onChange([...files, ...imgs])
  }

  function removeAt(i: number) {
    onChange(files.filter((_, idx) => idx !== i))
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!disabled) addFiles(e.dataTransfer.files) }}
        onClick={() => !disabled && inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-sm border-2 border-dashed border-border-hi py-8 hover:border-accent transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-mute">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="text-sm text-text-mute">{TRADES.FORM.ATTACH_ADD}</span>
        <span className="text-xxs text-text-mute opacity-60">{TRADES.FORM.ATTACH_HINT}</span>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="relative rounded-sm overflow-hidden bg-surface-2 group"
              style={{ aspectRatio: "16 / 9" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[i]} alt={f.name} className="w-full h-full object-cover" draggable={false} />
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={disabled}
                className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full text-text-dim opacity-0 group-hover:opacity-100 hover:text-loss transition-all cursor-pointer"
                style={{ background: "rgba(10,10,15,.8)" }}
              >
                <span className="text-sm leading-none">×</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
    </div>
  )
}
