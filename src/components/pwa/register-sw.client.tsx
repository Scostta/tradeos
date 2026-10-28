"use client"

import { useEffect } from "react"

// Registers the service worker (production only) so the app is installable and
// has an offline fallback. In dev it removes any worker left on localhost by a
// production run (`next start`): it would keep serving stale /_next/static
// chunks from its cache and hide code changes.
export function RegisterSW(): null {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then(async (regs) => {
        if (regs.length === 0) return
        await Promise.all(regs.map((r) => r.unregister()))
        const keys = await caches.keys()
        await Promise.all(keys.filter((k) => k.startsWith("tradeos-")).map((k) => caches.delete(k)))
      })
      return
    }

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
