// ── User profile domain types ─────────────────────────────────────────────────
// 1:1 with auth.users. Stores user preferences (display name, timezone, default
// currency). Timezone is persisted only for now — bucketing stays in UTC.

import { z } from "zod"
import { TIMEZONES, CURRENCIES } from "~/constants/timezones"

const timezoneSchema = z.enum(TIMEZONES)
const currencySchema = z.enum(CURRENCIES)

export const profileSchema = z.object({
  userId:          z.string().uuid(),
  displayName:     z.string().nullable(),
  timezone:        timezoneSchema,
  defaultCurrency: currencySchema,
  createdAt:       z.string().datetime({ offset: true }),
  updatedAt:       z.string().datetime({ offset: true }),
})
export type Profile = z.infer<typeof profileSchema>

// ── Action inputs ─────────────────────────────────────────────────────────────

export const updateProfileInputSchema = z.object({
  displayName:     z.string().trim().max(60).nullable(),
  timezone:        timezoneSchema,
  defaultCurrency: currencySchema,
})
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>

export const changeEmailInputSchema = z.object({
  email: z.string().email(),
})
export type ChangeEmailInput = z.infer<typeof changeEmailInputSchema>

export const changePasswordInputSchema = z.object({
  password: z.string().min(8, "PASSWORD_TOO_SHORT"),
})
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>

export const deleteAccountInputSchema = z.object({
  confirmEmail: z.string(),
})
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>
