"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { createServerClient } from "~/utils/supabase/service"
import { mapProfileFromDb } from "~/services/mappers/profiles"
import { createDataResult, createErrorResult } from "~/helpers/result"
import {
  updateProfileInputSchema,
  changeEmailInputSchema,
  changePasswordInputSchema,
  deleteAccountInputSchema,
} from "~/types/profile"
import type { ResultType } from "~/helpers/result"
import type { Profile } from "~/types/profile"

/**
 * Upserts the user's preferences (display name, timezone, default currency).
 * The row is created on first save (no signup trigger). Revalidates the layout
 * so the sidebar picks up a changed display name.
 */
export async function updateProfile(input: unknown): Promise<ResultType<Profile, string>> {
  const parsed = updateProfileInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { displayName, timezone, defaultCurrency } = parsed.data

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id:          user.id,
        display_name:     displayName,
        timezone,
        default_currency: defaultCurrency,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/settings")
  revalidatePath("/", "layout")
  return createDataResult(mapProfileFromDb(data))
}

/**
 * Starts an email change. Supabase sends a confirmation link to the new address;
 * the change only takes effect once the user confirms.
 */
export async function updateEmail(input: unknown): Promise<ResultType<true, string>> {
  const parsed = changeEmailInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_EMAIL")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { error } = await supabase.auth.updateUser({ email: parsed.data.email })
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  return createDataResult(true)
}

/** Sets a new password for the signed-in user. */
export async function updatePassword(input: unknown): Promise<ResultType<true, string>> {
  const parsed = changePasswordInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("PASSWORD_TOO_SHORT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  return createDataResult(true)
}

/**
 * Permanently deletes the account. Requires the user to re-type their email.
 * Clears app data first (FKs to auth.users have no cascade) then removes the
 * auth user with the service-role admin client. The caller signs out after.
 */
export async function deleteAccount(input: unknown): Promise<ResultType<true, string>> {
  const parsed = deleteAccountInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  if (parsed.data.confirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return createErrorResult("EMAIL_MISMATCH")
  }

  const admin = createServerClient()

  // accounts → cascades to trades & trade_attachments. The rest reference
  // auth.users by user_id without cascade, so delete them explicitly.
  const accountsDelete = await admin.from("accounts").delete().eq("user_id", user.id)
  if (accountsDelete.error) {
    console.error(accountsDelete.error)
    return createErrorResult(accountsDelete.error.message)
  }

  for (const table of ["daily_journal", "playbooks", "user_goals", "ai_insights", "profiles"]) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id)
    if (error) {
      console.error(error)
      return createErrorResult(error.message)
    }
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteUserError) {
    console.error(deleteUserError)
    return createErrorResult(deleteUserError.message)
  }

  return createDataResult(true)
}
