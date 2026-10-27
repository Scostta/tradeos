"use client"

import type { MouseEvent, ReactElement, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { cn } from "~/utils/cn"

const INTERACTIVE = "a, button, input, textarea, select, label, summary"

// Fila de tabla que navega a `href` al hacer clic en cualquier parte. Los
// controles de la fila (enlace del ticker, botón Open/Close) siguen haciendo lo
// suyo, y los clics dentro de un modal (portal: fuera de la fila en el DOM,
// pero dentro en el árbol de React) no navegan.
export function ClickableRow({ href, className, children }: {
  href:       string
  className?: string
  children:   ReactNode
}): ReactElement {
  const router = useRouter()

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement
    if (!e.currentTarget.contains(target) || target.closest(INTERACTIVE)) return
    if (window.getSelection()?.toString()) return   // seleccionar texto no navega
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank")
    else router.push(href)
  }

  return (
    <tr onClick={onClick} className={cn("cursor-pointer", className)}>
      {children}
    </tr>
  )
}
