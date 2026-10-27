"use client"

import { useEffect } from "react"
import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import { ACTIVE_MODULE_STORAGE_KEY, MODULE_HOME, parseModule } from "~/helpers/active-module"

// "/" con sesión → home del último módulo visitado (localStorage), o Trading.
// Sin sesión el middleware ya redirige a /login antes de llegar aquí.
export function RootRedirect(): ReactElement {
  const router = useRouter()

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(ACTIVE_MODULE_STORAGE_KEY)
    } catch {
      // Sin storage: Trading.
    }
    router.replace(MODULE_HOME[parseModule(stored) ?? "trading"])
  }, [router])

  return <div className="h-dvh bg-bg" />
}
