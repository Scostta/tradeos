"use client"

import { useSyncExternalStore } from "react"
import { SIDEBAR_MODULE_FOOTER_ID } from "~/components/layout/sidebar-slot"

const subscribe = () => () => {}

/** Nodo del hueco del sidebar para un portal; null en el servidor y en la hidratación. */
export function useSidebarSlot(): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => document.getElementById(SIDEBAR_MODULE_FOOTER_ID),
    () => null,
  )
}
