"use client"

import { useEffect } from "react"

// Registers the service worker (production only) so the app is installable and
// has an offline fallback. No-op in dev to avoid confusing cache behavior.
export function RegisterSW(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err)
      })
    }
    window.addEventListener("load", onLoad)
    return () => window.removeEventListener("load", onLoad)
  }, [])

  return null
}
