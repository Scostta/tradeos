"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { saveCommissionRatesInputSchema, updateAccountInputSchema } from "~/types/account"
import { reapplyCommissionRates } from "~/services/commission-rates"
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
    maxTradesPerDay, maxDailyLoss, maxConsecutiveLosses,
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
      max_trades_per_day:     maxTradesPerDay,
      max_daily_loss:         maxDailyLoss,
      max_consecutive_losses: maxConsecutiveLosses,
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
  revalidatePath("/review")
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

/**
 * Tarifas de comisión de una cuenta (ida y vuelta por contrato). Guarda las
 * dadas (null = quitar) y recalcula los trades de la cuenta sin comisión real:
 * se estiman con la tarifa nueva; los de un instrumento sin tarifa vuelven a 0.
 */
export async function saveCommissionRates(
  input: unknown,
): Promise<ResultType<{ updated: number }, "INVALID_INPUT" | "UNAUTHENTICATED" | "NOT_FOUND" | "UNKNOWN">> {
  const parsed = saveCommissionRatesInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const { accountId, rates } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: account } = await supabase.from("accounts").select("id").eq("id", accountId).eq("user_id", user.id).maybeSingle()
  if (!account) return createErrorResult("NOT_FOUND")

  const upserts = rates.filter(r => r.roundTurn != null)
    .map(r => ({ user_id: user.id, account_id: accountId, instrument: r.instrument, round_turn: r.roundTurn!, updated_at: new Date().toISOString() }))
  const deletes = rates.filter(r => r.roundTurn == null).map(r => r.instrument)
  if (upserts.length) {
    const { error } = await supabase.from("commission_rates").upsert(upserts, { onConflict: "account_id,instrument" })
    if (error) {
      console.error(error)
      return createErrorResult("UNKNOWN")
    }
  }
  if (deletes.length) {
    const { error } = await supabase.from("commission_rates").delete().eq("account_id", accountId).eq("user_id", user.id).in("instrument", deletes)
    if (error) {
      console.error(error)
      return createErrorResult("UNKNOWN")
    }
  }

  const { data: kept, error: readError } = await supabase.from("commission_rates").select("instrument, round_turn").eq("account_id", accountId)
  if (readError) {
    console.error(readError)
    return createErrorResult("UNKNOWN")
  }
  const all = (kept ?? []).map(r => ({ instrument: r.instrument as string, roundTurn: Number(r.round_turn) }))
  const updated = await reapplyCommissionRates(supabase, user.id, accountId, all)
  if (updated == null) return createErrorResult("UNKNOWN")

  revalidatePath("/accounts")
  revalidatePath("/trades")
  revalidatePath("/dashboard")
  return createDataResult({ updated })
}
