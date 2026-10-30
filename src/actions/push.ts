"use server"

import { z } from "zod"
import { createClient } from "~/utils/supabase/server"
import { pushConfigured, sendPushToUsers } from "~/lib/push/send"
import { SETTINGS } from "~/constants/copies/settings"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import { pushSubscriptionInputSchema } from "~/types/push"

/** Guarda la suscripción de este navegador (un endpoint = un dispositivo). */
export async function savePushSubscription(input: unknown): Promise<ResultType<null, string>> {
  const parsed = pushSubscriptionInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { endpoint, keys, userAgent } = parsed.data
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: userAgent },
      { onConflict: "endpoint" },
    )
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult(null)
}

/** Quita la suscripción de este navegador. */
export async function deletePushSubscription(input: unknown): Promise<ResultType<null, string>> {
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint)
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }
  return createDataResult(null)
}

/** Manda un aviso de prueba a todos los dispositivos del usuario. Devuelve a cuántos llegó. */
export async function sendTestPush(): Promise<ResultType<{ sent: number }, string>> {
  if (!pushConfigured()) return createErrorResult(SETTINGS.NOTIFICATIONS.NOT_CONFIGURED)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const result = await sendPushToUsers([user.id], {
    title: SETTINGS.NOTIFICATIONS.TEST_TITLE,
    body:  SETTINGS.NOTIFICATIONS.TEST_BODY,
    url:   "/settings",
    tag:   "test",
  })
  if (result.sent === 0) return createErrorResult(SETTINGS.NOTIFICATIONS.TEST_NONE)
  return createDataResult({ sent: result.sent })
}
