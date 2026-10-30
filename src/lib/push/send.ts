import "server-only"
import webpush from "web-push"
import { envClient } from "~/env/client"
import { envServer } from "~/env/server"
import { createServerClient } from "~/utils/supabase/service"
import type { PushMessage } from "~/types/push"

// Envío de Web Push con las claves VAPID. Siempre con el service-role client
// filtrando por user_id: lo llaman tanto acciones del usuario (prueba) como el
// endpoint del job (sin sesión). Las suscripciones que el servicio push da por
// muertas (404/410) se borran.

export function pushConfigured(): boolean {
  return envClient.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== "" && envServer.VAPID_PRIVATE_KEY !== "" && envServer.VAPID_SUBJECT !== ""
}

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string }

export type PushResult = { sent: number; removed: number; failed: number }

/** Manda `message` a todas las suscripciones de `userIds`. Nunca lanza. */
export async function sendPushToUsers(userIds: string[], message: PushMessage): Promise<PushResult> {
  const result: PushResult = { sent: 0, removed: 0, failed: 0 }
  if (!pushConfigured() || userIds.length === 0) return result

  const service = createServerClient()
  const { data, error } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds)
  if (error) {
    console.error(error)
    return { ...result, failed: 1 }
  }

  const payload = JSON.stringify(message)
  const options = {
    vapidDetails: {
      subject:    envServer.VAPID_SUBJECT,
      publicKey:  envClient.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      privateKey: envServer.VAPID_PRIVATE_KEY,
    },
    TTL: 60 * 60 * 24,   // un día: si el móvil está apagado, el aviso sigue valiendo
  }

  const dead: string[] = []
  const sentIds: string[] = []
  await Promise.all(((data ?? []) as SubscriptionRow[]).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options)
      sentIds.push(s.id)
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) dead.push(s.id)
      else {
        console.error("web push", status, (err as Error).message)
        result.failed++
      }
    }
  }))

  if (dead.length > 0) await service.from("push_subscriptions").delete().in("id", dead)
  if (sentIds.length > 0) {
    await service.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).in("id", sentIds)
  }
  return { ...result, sent: sentIds.length, removed: dead.length }
}

/** Todos los usuarios con alguna suscripción (avisos que no son de un usuario concreto). */
export async function subscribedUserIds(): Promise<string[]> {
  const { data, error } = await createServerClient().from("push_subscriptions").select("user_id")
  if (error) {
    console.error(error)
    return []
  }
  return [...new Set((data ?? []).map(r => r.user_id as string))]
}
