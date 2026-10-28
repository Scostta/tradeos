import type { ReactElement, ReactNode } from "react"
import Link from "next/link"
import { cn } from "~/utils/cn"

// Piezas de presentación del Overview (artboard 01).

export function Card({ title, link, right, children, className }: {
  title:      string
  link?:      { href: string; label: string }
  right?:     ReactNode
  children:   ReactNode
  className?: string
}): ReactElement {
  return (
    <div className={cn("card p-0 flex flex-col min-w-0", className)}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <span className="label-caps">{title}</span>
        {link ? <Link href={link.href} className="text-xs text-text-mute hover:text-text">{link.label}</Link> : right}
      </div>
      {children}
    </div>
  )
}

export function Metric({ label, value, tone, children, big }: {
  label:     string
  value:     string
  tone?:     string
  children?: ReactNode
  big?:      boolean
}): ReactElement {
  return (
    <div className="card flex flex-col gap-2 px-4 py-3.5 min-w-0">
      <span className="label-caps">{label}</span>
      <span className={cn("mono font-semibold tracking-tight leading-none", big ? "text-4xl" : "text-3xl", tone ?? "text-text")}>{value}</span>
      {children && <div className="text-xs text-text-mute mt-auto flex flex-col gap-1.5">{children}</div>}
    </div>
  )
}

/** Barra de progreso; `mark` (0–1) dibuja la referencia (media de 3 meses). */
export function Bar({ value, mark, color }: { value: number; mark?: number | null; color: string }): ReactElement {
  return (
    <div className="relative h-1.5 rounded-full bg-surface-2 overflow-visible">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color }} />
      {mark != null && (
        <div className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-full bg-text-dim" style={{ left: `${Math.min(100, mark * 100)}%` }} />
      )}
    </div>
  )
}

export function Chip({ tone, children, href }: { tone: "loss" | "short" | "profit"; children: ReactNode; href?: string }): ReactElement {
  const cls = cn(
    "mono text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm whitespace-nowrap",
    { loss: "bg-loss/10 text-loss", short: "bg-short/10 text-short", profit: "bg-profit/10 text-profit" }[tone],
  )
  return href ? <Link href={href} className={cn(cls, "hover:opacity-80")}>{children}</Link> : <span className={cls}>{children}</span>
}
