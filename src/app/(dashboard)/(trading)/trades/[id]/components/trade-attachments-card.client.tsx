"use client"

import { useState, useRef, useCallback, useEffect, useTransition } from "react"
import { createPortal } from "react-dom"
import {
  getTradeAttachments,
  uploadTradeAttachment,
  deleteTradeAttachment,
} from "~/actions/attachments"
import { TRADES } from "~/constants/copies/trades"
import type { TradeAttachment } from "~/actions/attachments"

const A = TRADES.ATTACHMENTS

// ── Icons ─────────────────────────────────────────────────────────────────────
const ChevronLeft  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
const ChevronRight = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
const XIcon        = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const TrashIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
const ZoomInIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
const ZoomOutIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
const FitIcon      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>

// ── Lightbox ──────────────────────────────────────────────────────────────────
const ZOOM_STEP = 0.3
const ZOOM_MIN  = 0.5
const ZOOM_MAX  = 4
const ZERO_OFFSET = { x: 0, y: 0 }

function IcoBtn({ onClick, title, children, danger = false }: {
  onClick: () => void; title: string; children: React.ReactNode; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-8 h-8 rounded transition-colors cursor-pointer"
      style={{ color: danger ? undefined : "rgba(255,255,255,.55)" }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? "rgba(239,68,68,.15)" : "rgba(255,255,255,.1)"; if (danger) e.currentTarget.style.color = "#ef4444" }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; if (danger) e.currentTarget.style.color = "rgba(255,255,255,.55)" }}
    >
      {children}
    </button>
  )
}

function Lightbox({
  images, index, onClose, onPrev, onNext, onSetIndex, onDelete,
}: {
  images:     TradeAttachment[]
  index:      number
  onClose:    () => void
  onPrev:     () => void
  onNext:     () => void
  onSetIndex: (i: number) => void
  onDelete:   (img: TradeAttachment) => void
}) {
  const [zoom,      setZoom]      = useState(1)
  const [offset,    setOffset]    = useState(ZERO_OFFSET)
  const [dragging,  setDragging]  = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const stripRef  = useRef<HTMLDivElement>(null)
  const img = images[index]!

  // Zoom changes funnel through here so we can recentre when zooming back
  // out, without a state-syncing effect.
  function applyZoom(next: number) {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +next.toFixed(1)))
    setZoom(z)
    if (z <= 1) setOffset(ZERO_OFFSET)
  }

  // Reset the view, then delegate navigation to the parent. Resetting here
  // (rather than in an effect on `index`) keeps zoom/offset out of effects.
  function resetView() {
    setZoom(1)
    setOffset(ZERO_OFFSET)
  }
  function goPrev()               { resetView(); onPrev() }
  function goNext()               { resetView(); onNext() }
  function selectIndex(i: number) { resetView(); onSetIndex(i) }

  // Scroll the active thumbnail into view — DOM side effect only, no setState.
  useEffect(() => {
    stripRef.current?.children[index]?.scrollIntoView({ inline: "center", behavior: "smooth" })
  }, [index])

  function handleMouseDown(e: React.MouseEvent) {
    if (zoom <= 1 || e.button !== 0) return
    e.preventDefault()
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
    setDragging(true)
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragStart.current) return
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.mx),
      y: dragStart.current.oy + (e.clientY - dragStart.current.my),
    })
  }

  function handleMouseUp() {
    dragStart.current = null
    setDragging(false)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")     { onClose(); return }
      if (e.key === "ArrowLeft")  { setZoom(1); setOffset(ZERO_OFFSET); onPrev(); return }
      if (e.key === "ArrowRight") { setZoom(1); setOffset(ZERO_OFFSET); onNext(); return }
      if (e.key === "+" || e.key === "=") { setZoom(Math.min(ZOOM_MAX, +(zoom + ZOOM_STEP).toFixed(1))) }
      if (e.key === "-") {
        const z = Math.max(ZOOM_MIN, +(zoom - ZOOM_STEP).toFixed(1))
        setZoom(z)
        if (z <= 1) setOffset(ZERO_OFFSET)
      }
      if (e.key === "0") { setZoom(1); setOffset(ZERO_OFFSET) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [zoom, onClose, onPrev, onNext])

  const THUMB_H = 72

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col select-none" style={{ background: "#1c1c1c" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 px-4 shrink-0"
        style={{ height: 40, background: "#111", borderBottom: "1px solid rgba(255,255,255,.06)" }}
      >
        <span className="mono text-xs" style={{ color: "rgba(255,255,255,.4)", marginRight: 8 }}>
          {index + 1} / {images.length}
        </span>

        <div className="flex-1" />

        <IcoBtn onClick={() => applyZoom(zoom + ZOOM_STEP)} title={A.ZOOM_IN}>
          <ZoomInIcon />
        </IcoBtn>
        <IcoBtn onClick={() => applyZoom(zoom - ZOOM_STEP)} title={A.ZOOM_OUT}>
          <ZoomOutIcon />
        </IcoBtn>
        <IcoBtn onClick={() => applyZoom(1)} title={A.RESET_ZOOM}>
          <FitIcon />
        </IcoBtn>

        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,.12)", margin: "0 6px" }} />

        <IcoBtn onClick={() => { onDelete(img) }} title={A.DELETE} danger>
          <TrashIcon />
        </IcoBtn>
        <IcoBtn onClick={onClose} title={A.CLOSE}>
          <XIcon />
        </IcoBtn>
      </div>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      {/* items-stretch (default) so the image container fills the full height */}
      <div className="flex flex-1 min-h-0">

        {/* Prev arrow */}
        <button
          onClick={goPrev}
          disabled={images.length <= 1}
          className="flex items-center justify-center shrink-0 cursor-pointer transition-colors disabled:opacity-0"
          style={{ width: 64, color: "rgba(255,255,255,.6)", background: "transparent" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.04)" }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
        >
          <ChevronLeft />
        </button>

        {/* Image — container stretches to full row height, image constrained inside */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden"
          style={{
            padding: 16,
            cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.publicUrl}
            alt={img.fileName}
            draggable={false}
            style={{
              display:         "block",
              maxWidth:        "100%",
              maxHeight:       "100%",
              width:           "auto",
              height:          "auto",
              objectFit:       "contain",
              transform:       `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
              transformOrigin: "center",
              transition:      dragging ? "none" : "transform .15s ease",
              boxShadow:       "0 4px 32px rgba(0,0,0,.5)",
              userSelect:      "none",
            }}
          />
        </div>

        {/* Next arrow */}
        <button
          onClick={goNext}
          disabled={images.length <= 1}
          className="flex items-center justify-center shrink-0 cursor-pointer transition-colors disabled:opacity-0"
          style={{ width: 64, color: "rgba(255,255,255,.6)", background: "transparent" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.04)" }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
        >
          <ChevronRight />
        </button>
      </div>

      {/* ── Thumbnail strip ───────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center gap-1 overflow-x-auto px-2"
        ref={stripRef}
        style={{ height: THUMB_H + 16, background: "#111", borderTop: "1px solid rgba(255,255,255,.06)", scrollbarWidth: "none" }}
      >
        {images.map((im, i) => (
          <button
            key={im.id}
            onClick={() => selectIndex(i)}
            className="shrink-0 rounded-sm overflow-hidden cursor-pointer transition-all"
            style={{
              height:  THUMB_H,
              width:   THUMB_H * (16 / 9),
              opacity: i === index ? 1 : 0.45,
              border:  `2px solid ${i === index ? "rgba(255,255,255,.8)" : "transparent"}`,
              transform: i === index ? "scale(1.04)" : "scale(1)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.publicUrl} alt={im.fileName} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

    </div>,
    document.body,
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function TradeAttachmentsCard({ tradeId }: { tradeId: string }) {
  const [images,      setImages]     = useState<TradeAttachment[]>([])
  const [current,     setCurrent]    = useState(0)
  const [isDragging,  setIsDragging] = useState(false)
  const [isLoading,   setIsLoading]  = useState(true)
  const [lightbox,    setLightbox]   = useState(false)
  const [isPending,   startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getTradeAttachments(tradeId).then(result => {
      if (result.success) { setImages(result.data); setCurrent(0) }
      setIsLoading(false)
    })
  }, [tradeId])

  const uploadFiles = useCallback((files: FileList | null) => {
    if (!files || isPending) return
    const valid = Array.from(files).filter(f => f.type.startsWith("image/"))
    if (!valid.length) return
    startTransition(async () => {
      const results = await Promise.all(
        valid.map(file => {
          const fd = new FormData()
          fd.append("file", file)
          fd.append("tradeId", tradeId)
          return uploadTradeAttachment(fd)
        })
      )
      const uploaded = results.flatMap(r => (r.success ? [r.data] : []))
      if (uploaded.length) {
        setImages(prev => {
          const next = [...prev, ...uploaded]
          setCurrent(next.length - 1)
          return next
        })
      }
    })
  }, [tradeId, isPending])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false); uploadFiles(e.dataTransfer.files)
  }, [uploadFiles])

  const handleRemove = useCallback((img: TradeAttachment) => {
    setLightbox(false)
    startTransition(async () => {
      await deleteTradeAttachment(img.id)
      setImages(prev => {
        const next = prev.filter(i => i.id !== img.id)
        setCurrent(c => Math.min(c, Math.max(0, next.length - 1)))
        return next
      })
    })
  }, [])

  const goPrev = useCallback(() => setCurrent(c => (c - 1 + images.length) % images.length), [images.length])
  const goNext = useCallback(() => setCurrent(c => (c + 1) % images.length), [images.length])

  if (isLoading) {
    return (
      <div className="card p-4">
        <div className="label-caps mb-3">{A.TITLE}</div>
        <div className="flex items-center justify-center h-24 text-xxs text-text-mute">{A.LOADING}</div>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="label-caps">{A.TITLE}</div>
        {images.length > 0 && (
          <span className="mono text-xxs text-text-mute">{current + 1} / {images.length}</span>
        )}
      </div>

      {images.length === 0 ? (
        /* ── Drop zone ─────────────────────────────────────────────────── */
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-sm border-2 border-dashed transition-colors"
          style={{
            height:      104,
            borderColor: isDragging ? "var(--color-accent)" : "var(--color-border-hi)",
            background:  isDragging ? "rgba(163,230,53,.05)" : "transparent",
          }}
        >
          {isPending ? (
            <span className="text-xs text-text-mute">{A.UPLOADING}</span>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-mute">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-xs text-text-mute">{A.DROP}</span>
              <span className="text-xxs text-text-mute opacity-60">{A.FORMATS}</span>
            </>
          )}
        </div>
      ) : (
        /* ── Carousel ──────────────────────────────────────────────────── */
        <div className="flex flex-col gap-2">
          {/* Main image */}
          <div
            className="relative rounded-sm overflow-hidden bg-surface-2 group cursor-pointer"
            style={{ aspectRatio: "16 / 9" }}
            onClick={() => setLightbox(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[current]!.publicUrl}
              alt={images[current]!.fileName}
              className="w-full h-full object-contain"
              draggable={false}
            />

            {/* Delete — top right */}
            <button
              onClick={e => { e.stopPropagation(); handleRemove(images[current]!) }}
              disabled={isPending}
              className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40 cursor-pointer"
              style={{ background: "rgba(10,10,15,.8)", color: "var(--color-text-dim)" }}
              onMouseEnter={e => { if (!isPending) e.currentTarget.style.color = "var(--color-loss)" }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-dim)" }}
            >
              <TrashIcon />
            </button>

            {/* Prev — left center */}
            {images.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); goPrev() }}
                className="absolute flex items-center justify-center w-7 h-7 rounded-full text-text-dim hover:text-text transition-all opacity-0 group-hover:opacity-100 hover:scale-110 cursor-pointer"
                style={{ left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(10,10,15,.7)" }}
              >
                <ChevronLeft />
              </button>
            )}

            {/* Next — right center */}
            {images.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); goNext() }}
                className="absolute flex items-center justify-center w-7 h-7 rounded-full text-text-dim hover:text-text transition-all opacity-0 group-hover:opacity-100 hover:scale-110 cursor-pointer"
                style={{ right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(10,10,15,.7)" }}
              >
                <ChevronRight />
              </button>
            )}

            {/* Upload overlay */}
            {isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/60">
                <span className="text-xs text-text-mute">{A.UPLOADING}</span>
              </div>
            )}

            {/* Dot indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={e => { e.stopPropagation(); setCurrent(i) }}
                    className="w-1.5 h-1.5 rounded-full transition-colors"
                    style={{ background: i === current ? "var(--color-accent)" : "rgba(255,255,255,.25)" }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setCurrent(i)}
                  className="shrink-0 rounded-xs overflow-hidden transition-all"
                  style={{
                    width:   52,
                    height:  38,
                    opacity: i === current ? 1 : 0.4,
                    border:  `1px solid ${i === current ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.publicUrl} alt={img.fileName} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Add more */}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={isPending}
            className="w-full py-1.5 text-xs text-text-mute border border-dashed border-border hover:border-border-hi hover:text-text-dim rounded-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {A.ADD_MORE}
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={e => uploadFiles(e.target.files)}
      />

      {/* Lightbox */}
      {lightbox && images.length > 0 && (
        <Lightbox
          images={images}
          index={current}
          onClose={() => setLightbox(false)}
          onPrev={goPrev}
          onNext={goNext}
          onSetIndex={setCurrent}
          onDelete={handleRemove}
        />
      )}
    </div>
  )
}
