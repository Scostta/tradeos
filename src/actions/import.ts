"use server"

import { z } from "zod"
import { createClient } from "~/utils/supabase/server"
import { loadCommissionRates, withEstimatedCommission } from "~/services/commission-rates"
import { importTradesInputSchema } from "~/types/import"
import type {
  DuplicateKey,
  ExclusionKey,
  ImportKeyCheck,
  ImportSummary,
  ImportRow,
} from "~/types"
import { importKeyMatches } from "~/helpers/trade-fingerprint"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

const findKeysInputSchema = z.array(
  z.object({
    importKey:   z.string().min(1),
    accountName: z.string(),
  })
)

const keyOf = (accountId: string, importKey: string) =>
  `${accountId}||${importKey}`

/** Tamaño de lote para `.in()`: las claves viajan en la URL de PostgREST. */
const IN_CHUNK = 100

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

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

  // Solo se consultan las claves del CSV (no toda la tabla, que PostgREST
  // corta a 1000 filas).
  const importKeys = [...new Set(parsed.data.map((k) => k.importKey))]
  const tradeSet = new Set<string>()
  const exclusionSet = new Set<string>()

  for (const batch of chunk(importKeys, IN_CHUNK)) {
    const [tradesRes, exclusionsRes] = await Promise.all([
      supabase
        .from("trades")
        .select("account_id, import_key")
        .eq("user_id", user.id)
        .in("import_key", batch),
      supabase
        .from("import_exclusions")
        .select("account_id, import_key")
        .eq("user_id", user.id)
        .in("import_key", batch),
    ])

    if (tradesRes.error) {
      console.error(tradesRes.error)
      return createErrorResult(tradesRes.error.message)
    }
    if (exclusionsRes.error) {
      console.error(exclusionsRes.error)
      return createErrorResult(exclusionsRes.error.message)
    }

    for (const t of tradesRes.data ?? []) tradeSet.add(keyOf(t.account_id, t.import_key))
    for (const e of exclusionsRes.data ?? []) exclusionSet.add(keyOf(e.account_id, e.import_key))
  }

  const duplicates: DuplicateKey[] = []
  const excluded: DuplicateKey[] = []

  for (const key of parsed.data) {
    const accountId = accountNameToId.get(key.accountName)
    if (!accountId) continue

    const k = keyOf(accountId, key.importKey)
    // Una exclusión manda sobre el estado en trades: si el usuario la excluyó,
    // el trade ya no está en BD y la fila se muestra como "skipped".
    if (exclusionSet.has(k)) excluded.push(key)
    else if (tradeSet.has(k)) duplicates.push(key)
  }

  return createDataResult({ duplicates, excluded })
}

/**
 * Importa trades y aplica las exclusiones del preview en una sola pasada:
 * - `rows`      → upsert en trades (idempotente por (account_id, import_key))
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

  // La clave viene del cliente: su huella tiene que casar con la fila.
  if (!rows.every(importKeyMatches)) return createErrorResult("INVALID_IMPORT_KEY")

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

  /** Claves del CSV → (account_id, import_key), deduplicadas. */
  function resolveKeys(keys: ExclusionKey[]) {
    const seen = new Set<string>()
    const out: { account_id: string; import_key: string }[] = []
    for (const key of keys) {
      const accountId = nameToId.get(key.accountName)
      if (!accountId) continue
      const k = keyOf(accountId, key.importKey)
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ account_id: accountId, import_key: key.importKey })
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
      .eq("import_key", key.import_key)

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
      { onConflict: "account_id,import_key", ignoreDuplicates: true }
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
      .eq("import_key", key.import_key)

    if (error) {
      console.error(error)
      return createErrorResult(error.message)
    }
    deleted += count ?? 0
  }

  // ── 4. Insertar los trades que sí se quieren ───────────────────────────────
  const excludedSet = new Set(
    excludeKeys.map((k) => keyOf(k.account_id, k.import_key))
  )

  const seen = new Set<string>()
  // Filas sin comisión: tarifa de su cuenta, si la tiene. Si las tarifas no se
  // pueden leer, se importa igual sin estimar.
  const rates = (await loadCommissionRates(supabase, [...new Set(nameToId.values())])) ?? new Map()

  const tradeRows = rows
    .map((row: ImportRow) => {
      const accountId = nameToId.get(row.accountName)
      if (!accountId) return null

      return {
        user_id: user.id,
        account_id: accountId,
        trade_number: row.tradeNumber,
        import_key:   row.importKey,
        instrument: row.instrument,
        direction: row.direction,
        contracts: row.contracts,
        entry_price: row.entryPrice,
        exit_price: row.exitPrice,
        entry_time: row.entryTime,
        exit_time: row.exitTime,
        pnl: row.pnl,
        ...withEstimatedCommission(row, rates.get(accountId)),
        mae: row.mae,
        mfe: row.mfe,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .filter((r) => {
      const key = keyOf(r.account_id, r.import_key)
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
        onConflict: "account_id,import_key",
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
