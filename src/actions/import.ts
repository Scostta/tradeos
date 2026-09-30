"use server"

import { z } from "zod"
import { createClient } from "~/utils/supabase/server"
import { importTradesInputSchema } from "~/types/import"
import type {
  DuplicateKey,
  ExclusionKey,
  ImportKeyCheck,
  ImportSummary,
  ParsedRow,
} from "~/types"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

const findKeysInputSchema = z.array(
  z.object({
    tradeNumber: z.number().int(),
    accountName: z.string(),
  })
)

const keyOf = (accountId: string, tradeNumber: number) =>
  `${accountId}||${tradeNumber}`

/**
 * Cruza las claves naturales del CSV con lo que ya hay en BD: qué trades están
 * ya importados (`duplicates`) y qué trades el usuario excluyó en un import
 * anterior (`excluded`, en import_exclusions).
 */
export async function checkImportKeys(
  keys: unknown
): Promise<ResultType<ImportKeyCheck, string>> {
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

  const [tradesRes, exclusionsRes] = await Promise.all([
    supabase
      .from("trades")
      .select("account_id, trade_number")
      .eq("user_id", user.id),
    supabase
      .from("import_exclusions")
      .select("account_id, trade_number")
      .eq("user_id", user.id),
  ])

  if (tradesRes.error) {
    console.error(tradesRes.error)
    return createErrorResult(tradesRes.error.message)
  }
  if (exclusionsRes.error) {
    console.error(exclusionsRes.error)
    return createErrorResult(exclusionsRes.error.message)
  }

  const tradeSet = new Set<string>(
    (tradesRes.data ?? []).map((t) => keyOf(t.account_id, t.trade_number))
  )
  const exclusionSet = new Set<string>(
    (exclusionsRes.data ?? []).map((e) => keyOf(e.account_id, e.trade_number))
  )

  const duplicates: DuplicateKey[] = []
  const excluded: DuplicateKey[] = []

  for (const key of parsed.data) {
    const accountId = accountNameToId.get(key.accountName)
    if (!accountId) continue

    const k = keyOf(accountId, key.tradeNumber)
    // Una exclusión manda sobre el estado en trades: si el usuario la excluyó,
    // el trade ya no está en BD y la fila se muestra como "skipped".
    if (exclusionSet.has(k)) excluded.push(key)
    else if (tradeSet.has(k)) duplicates.push(key)
  }

  return createDataResult({ duplicates, excluded })
}

/**
 * Importa trades y aplica las exclusiones del preview en una sola pasada:
 * - `rows`      → upsert en trades (idempotente por (account_id, trade_number))
 * - `exclude`   → alta en import_exclusions + borrado del trade si ya existía
 * - `unexclude` → baja de import_exclusions (esas filas vienen también en `rows`)
 */
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

  const { rows, exclude, unexclude } = parsed.data

  const uniqueNames = [
    ...new Set([
      ...rows.map((r) => r.accountName),
      ...exclude.map((e) => e.accountName),
      ...unexclude.map((e) => e.accountName),
    ]),
  ]

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

  /** Claves del CSV → (account_id, trade_number), deduplicadas. */
  function resolveKeys(keys: ExclusionKey[]) {
    const seen = new Set<string>()
    const out: { account_id: string; trade_number: number }[] = []
    for (const key of keys) {
      const accountId = nameToId.get(key.accountName)
      if (!accountId) continue
      const k = keyOf(accountId, key.tradeNumber)
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ account_id: accountId, trade_number: key.tradeNumber })
    }
    return out
  }

  const excludeKeys = resolveKeys(exclude)
  const unexcludeKeys = resolveKeys(unexclude)

  // ── 1. Levantar exclusiones que el usuario ha vuelto a marcar ──────────────
  let restored = 0
  for (const key of unexcludeKeys) {
    const { error, count } = await supabase
      .from("import_exclusions")
      .delete({ count: "exact" })
      .eq("user_id", user.id)
      .eq("account_id", key.account_id)
      .eq("trade_number", key.trade_number)

    if (error) {
      console.error(error)
      return createErrorResult(error.message)
    }
    restored += count ?? 0
  }

  // ── 2. Registrar exclusiones (antes de insertar, para no reimportarlas) ────
  let excludedCount = 0
  if (excludeKeys.length > 0) {
    const { error } = await supabase.from("import_exclusions").upsert(
      excludeKeys.map((k) => ({ user_id: user.id, ...k })),
      { onConflict: "account_id,trade_number", ignoreDuplicates: true }
    )

    if (error) {
      console.error(error)
      return createErrorResult(error.message)
    }
    excludedCount = excludeKeys.length
  }

  // ── 3. Borrar de trades los excluidos que ya estuvieran importados ─────────
  let deleted = 0
  for (const key of excludeKeys) {
    const { error, count } = await supabase
      .from("trades")
      .delete({ count: "exact" })
      .eq("user_id", user.id)
      .eq("account_id", key.account_id)
      .eq("trade_number", key.trade_number)

    if (error) {
      console.error(error)
      return createErrorResult(error.message)
    }
    deleted += count ?? 0
  }

  // ── 4. Insertar los trades que sí se quieren ───────────────────────────────
  const excludedSet = new Set(
    excludeKeys.map((k) => keyOf(k.account_id, k.trade_number))
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
      const key = keyOf(r.account_id, r.trade_number)
      // Una exclusión en la misma operación gana sobre la fila a importar.
      if (excludedSet.has(key)) return false
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  let imported = 0
  if (tradeRows.length > 0) {
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

    imported = insertedTrades?.length ?? 0
  }

  return createDataResult({
    imported,
    excluded: excludedCount,
    deleted,
    restored,
  })
}
