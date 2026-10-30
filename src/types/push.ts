import { z } from "zod"

// Lo que viaja en cada Web Push; public/sw.js lo pinta como notificación.
export type PushMessage = {
  title: string
  body:  string
  url:   string          // ruta de la app (o URL externa) que abre al tocarla
  tag?:  string          // misma etiqueta = reemplaza la notificación anterior
}

// Suscripción tal como la da PushSubscription.toJSON() en el navegador.
export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
  userAgent: z.string().max(400).nullable(),
})
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>
