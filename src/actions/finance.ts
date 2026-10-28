"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { APP_URLS } from "~/constants/app-urls"
import { CASH_ACCOUNT_NAME, DEFAULT_CATEGORIES } from "~/lib/finance/default-categories"
import { createFinanceAccountInputSchema, setupMoneyInputSchema } from "~/types/finance"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

// Server actions de Money (MONEY_SPEC.md). Todas comprueban la sesión y
// escriben con el user_id de la sesión; la RLS lo vuelve a exigir.

export type FinanceActionError =
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "ALREADY_SET_UP"
  | "NO_SETTINGS"
  | "ACCOUNT_EXISTS"
  | "UNKNOWN"

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Categorías por defecto (§2.2). Idempotente: no toca las que ya existen. */
async function seedDefaultCategories(supabase: Supabase, userId: string): Promise<boolean> {
  const { error } = await supabase.from("finance_categories").upsert(
    DEFAULT_CATEGORIES.map((c, i) => ({
      user_id:  userId,
      name:     c.name,
      kind:     c.kind,
      is_fixed: c.isFixed,
      color:    c.color,
      sort:     i,
    })),
    { onConflict: "user_id,name", ignoreDuplicates: true },
  )
  if (error) console.error(error)
  return !error
}

/**
 * §5.1 alta de Money: la cuenta principal, la cuenta Cash del efectivo (§2.1),
 * el seed de categorías y finance_settings con la principal por defecto.
 * finance_settings va al final: si algo falla antes, repetir el alta no
 * duplica nada (upserts que ignoran lo existente).
 */
export async function setupMoney(input: unknown): Promise<ResultType<{ ok: true }, FinanceActionError>> {
  const parsed = setupMoneyInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const data = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: existing, error: settingsError } = await supabase
    .from("finance_settings").select("user_id").eq("user_id", user.id).maybeSingle()
  if (settingsError) {
    console.error(settingsError)
    return createErrorResult("UNKNOWN")
  }
  if (existing) return createErrorResult("ALREADY_SET_UP")

  const { error: accountsError } = await supabase.from("finance_accounts").upsert(
    [
      { user_id: user.id, name: data.accountName, kind: data.accountKind, iban_last4: data.ibanLast4 },
      { user_id: user.id, name: CASH_ACCOUNT_NAME, kind: "cash" },
    ],
    { onConflict: "user_id,name", ignoreDuplicates: true },
  )
  if (accountsError) {
    console.error(accountsError)
    return createErrorResult("UNKNOWN")
  }
  const { data: main, error: mainError } = await supabase
    .from("finance_accounts").select("id").eq("user_id", user.id).eq("name", data.accountName).single()
  if (mainError || !main) {
    console.error(mainError)
    return createErrorResult("UNKNOWN")
  }

  if (!(await seedDefaultCategories(supabase, user.id))) return createErrorResult("UNKNOWN")

  const { error } = await supabase
    .from("finance_settings")
    .insert({ user_id: user.id, default_account: main.id as string })
  if (error) {
    console.error(error)
    return createErrorResult(error.code === "23505" ? "ALREADY_SET_UP" : "UNKNOWN")
  }

  revalidatePath(APP_URLS.MONEY, "layout")
  return createDataResult({ ok: true })
}

/** Nueva cuenta bancaria (desde el import o desde ajustes). */
export async function createFinanceAccount(input: unknown): Promise<ResultType<{ id: string }, FinanceActionError>> {
  const parsed = createFinanceAccountInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const data = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: inserted, error } = await supabase
    .from("finance_accounts")
    .insert({ user_id: user.id, name: data.accountName, kind: data.accountKind, iban_last4: data.ibanLast4 })
    .select("id")
    .single()
  if (error) {
    if (error.code === "23505") return createErrorResult("ACCOUNT_EXISTS")
    console.error(error)
    return createErrorResult("UNKNOWN")
  }

  revalidatePath(APP_URLS.MONEY, "layout")
  return createDataResult({ id: inserted.id as string })
}
