"use server"

import { z } from "zod"
import { createClient } from "~/utils/supabase/server"
import { importTradesInputSchema } from "~/types/import"
import type { DuplicateKey, ImportSummary, ParsedRow } from "~/types"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

const findKeysInputSchema = z.array(
  z.object({
    tradeNumber: z.number().int(),
    accountName: z.string(),
  })
)

export async function findExistingTradeKeys(
  keys: unknown
): Promise<ResultType<DuplicateKey[], string>> {
  const parsed = findKeysInputSchema.safeParse(keys)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("user_id", user.id)

  if (accountsError) {
    console.error(accountsError)
    return createErrorResult(accountsError.message)
  }

  const accountNameToId = new Map<string, string>(
    (accounts ?? []).map((a) => [a.name, a.id])
  )

  const { data: existingTrades, error: tradesError } = await supabase
    .from("trades")
    .select("account_id, trade_number")
    .eq("user_id", user.id)

  if (tradesError) {
    console.error(tradesError)
    return createErrorResult(tradesError.message)
  }

  const tradeSet = new Set<string>(
    (existingTrades ?? []).map(
      (t) => `${t.account_id}||${t.trade_number}`
    )
  )

  const matched: DuplicateKey[] = []

  for (const key of parsed.data) {
    const accountId = accountNameToId.get(key.accountName)
    if (!accountId) continue

    if (tradeSet.has(`${accountId}||${key.tradeNumber}`)) {
      matched.push(key)
    }
  }

  return createDataResult(matched)
}

export async function importTrades(
  input: unknown
): Promise<ResultType<ImportSummary, string>> {
  const parsed = importTradesInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const rows = parsed.data.rows

  const uniqueNames = [...new Set(rows.map((r) => r.accountName))]

  const { error: upsertAccountsError } = await supabase
    .from("accounts")
    .upsert(
      uniqueNames.map((name) => ({ user_id: user.id, name })),
      { onConflict: "user_id,name", ignoreDuplicates: true }
    )

  if (upsertAccountsError) {
    console.error(upsertAccountsError)
    return createErrorResult(upsertAccountsError.message)
  }

  const { data: resolvedAccounts, error: resolveError } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("user_id", user.id)
    .in("name", uniqueNames)

  if (resolveError) {
    console.error(resolveError)
    return createErrorResult(resolveError.message)
  }

  const nameToId = new Map<string, string>(
    (resolvedAccounts ?? []).map((a) => [a.name, a.id])
  )

  const seen = new Set<string>()
  const tradeRows = rows
    .map((row: ParsedRow) => {
      const accountId = nameToId.get(row.accountName)
      if (!accountId) return null

      return {
        user_id: user.id,
        account_id: accountId,
        trade_number: row.tradeNumber,
        instrument: row.instrument,
        direction: row.direction,
        contracts: row.contracts,
        entry_price: row.entryPrice,
        exit_price: row.exitPrice,
        entry_time: row.entryTime,
        exit_time: row.exitTime,
        pnl: row.pnl,
        commission: row.commission,
        net_pnl: row.netPnl,
        mae: row.mae,
        mfe: row.mfe,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .filter((r) => {
      const key = `${r.account_id}||${r.trade_number}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  const { data: insertedTrades, error: upsertTradesError } = await supabase
    .from("trades")
    .upsert(tradeRows, {
      onConflict: "account_id,trade_number",
      ignoreDuplicates: true,
    })
    .select("id")

  if (upsertTradesError) {
    console.error(upsertTradesError)
    return createErrorResult(upsertTradesError.message)
  }

  const imported = insertedTrades?.length ?? 0

  return createDataResult({ imported })
}
