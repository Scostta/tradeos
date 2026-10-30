"use client"

import { useEffect, useState, useTransition } from "react"
import type { ReactElement } from "react"
import { deletePushSubscription, savePushSubscription, sendTestPush } from "~/actions/push"
import { SETTINGS } from "~/constants/copies/settings"
import { envClient } from "~/env/client"
import { Button } from "~/lib/ui/button"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"

const C = SETTINGS.NOTIFICATIONS

type Status = "loading" | "unsupported" | "dev" | "not-configured" | "denied" | "off" | "on"

// La clave pública VAPID viene en base64url; pushManager.subscribe la quiere en bytes.
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function subscriptionInput(sub: PushSubscription): unknown {
  const json = sub.toJSON()
  return { endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent.slice(0, 400) }
}

async function currentStatus(): Promise<{ status: Status; sub: PushSubscription | null }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { status: "unsupported", sub: null }
  }
  if (process.env.NODE_ENV !== "production") return { status: "dev", sub: null }
  if (envClient.NEXT_PUBLIC_VAPID_PUBLIC_KEY === "") return { status: "not-configured", sub: null }
  if (Notification.permission === "denied") return { status: "denied", sub: null }
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = (await reg?.pushManager.getSubscription()) ?? null
  return { status: sub ? "on" : "off", sub }
}

// Avisos push en este dispositivo (Web Push de la PWA). La suscripción vive en
// el navegador; push_subscriptions guarda una copia para que el servidor envíe.
export function NotificationsCard(): ReactElement {
  const [status, setStatus]          = useState<Status>("loading")
  const [toast, setToast]            = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [isPending, startTransition] = useTransition()

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 4000)
  }

  // Lee el estado del navegador al montar. Si ya está suscrito, vuelve a
  // guardar la suscripción (upsert): por si el servidor la borró al caducar.
  useEffect(() => {
    let cancelled = false
    void currentStatus().then(({ status: s, sub }) => {
      if (cancelled) return
      setStatus(s)
      if (sub) void savePushSubscription(subscriptionInput(sub))
    })
    return () => { cancelled = true }
  }, [])

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off")
          return
        }
        // Sin worker registrado, `ready` no se resolvería nunca: se registra aquí.
        if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register("/sw.js")
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: keyBytes(envClient.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        })
        const result = await savePushSubscription(subscriptionInput(sub))
        if (!result.success) {
          await sub.unsubscribe()
          showToast(result.error, "error")
          return
        }
        setStatus("on")
        showToast(C.ENABLED, "success")
      } catch (err) {
        console.error(err)
        showToast(C.ERROR, "error")
      }
    })
  }

  function disable() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        if (sub) {
          await deletePushSubscription({ endpoint: sub.endpoint })
          await sub.unsubscribe()
        }
        setStatus("off")
        showToast(C.DISABLED, "success")
      } catch (err) {
        console.error(err)
        showToast(C.ERROR, "error")
      }
    })
  }

  function test() {
    startTransition(async () => {
      const result = await sendTestPush()
      if (result.success) showToast(C.TEST_SENT.replace("{n}", String(result.data.sent)), "success")
      else showToast(result.error, "error")
    })
  }

  const message =
    status === "unsupported"    ? C.UNSUPPORTED :
    status === "dev"            ? C.DEV_ONLY :
    status === "not-configured" ? C.NOT_CONFIGURED :
    status === "denied"         ? C.DENIED :
    null

  return (
    <section className="card p-5 flex flex-col gap-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-md font-semibold text-text">{C.TITLE}</h2>
        <p className="text-sm text-text-dim">{C.DESCRIPTION}</p>
      </div>

      {message ? (
        <p className="text-sm text-text-mute">{message}</p>
      ) : status !== "loading" && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
          <span className={status === "on" ? "text-sm text-profit" : "text-sm text-text-mute"}>
            {status === "on" ? C.ON : C.OFF}
          </span>
          <div className="ml-auto flex gap-2">
            {status === "on" ? (
              <>
                <Button onClick={test} disabled={isPending}>{C.TEST}</Button>
                <Button onClick={disable} disabled={isPending}>{C.DISABLE}</Button>
              </>
            ) : (
              <Button variant="accent" onClick={enable} disabled={isPending} loading={isPending}>{C.ENABLE}</Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
