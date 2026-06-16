"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { updateAccountInputSchema } from "~/types/account"
import { mapAccountFromDb } from "~/services/mappers/accounts"
import type { Account } from "~/types/account"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

export async function updateAccount(
  input: unknown
): Promise<ResultType<Account, string>> {
  const parsed = updateAccountInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const {
    id, broker, accountType, initialBalance, color, notes,
    propPhase, drawdownType, drawdownAmount, drawdownLockAt,
    dailyLossLimit, profitTarget, minTradingDays, riskPerTrade,
  } = parsed.data

  const { data, error } = await supabase
    .from("accounts")
    .update({
      broker,
      account_type:      accountType,
      initial_balance:   initialBalance,
      color,
      notes,
      prop_phase:        propPhase,
      drawdown_type:     drawdownType,
      drawdown_amount:   drawdownAmount,
      drawdown_lock_at:  drawdownLockAt,
      daily_loss_limit:  dailyLossLimit,
      profit_target:     profitTarget,
      min_trading_days:  minTradingDays,
      risk_per_trade:    riskPerTrade,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single()

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/accounts")
  revalidatePath("/dashboard")
  return createDataResult(mapAccountFromDb(data))
}

const setActiveInputSchema = z.object({
  id:     z.string().uuid(),
  active: z.boolean(),
})

export async function setAccountActive(
  input: unknown
): Promise<ResultType<{ id: string; active: boolean }, string>> {
  const parsed = setActiveInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { id, active } = parsed.data

  const { error } = await supabase
    .from("accounts")
    .update({ active })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  revalidatePath("/accounts")
  return createDataResult({ id, active })
}
