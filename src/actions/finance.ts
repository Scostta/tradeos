"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "~/utils/supabase/server"
import { APP_URLS } from "~/constants/app-urls"
import { CASH_ACCOUNT_NAME, DEFAULT_CATEGORIES } from "~/lib/finance/default-categories"
import { manualImportKey, withFinanceImportKeys } from "~/lib/finance/fingerprint"
import { applyRules } from "~/lib/finance/match-rule"
import type { RuleAssignment } from "~/lib/finance/match-rule"
import { normalizeConcept } from "~/lib/finance/normalize-concept"
import { detectRecurring } from "~/lib/finance/recurring"
import {
  categorizeTransactionInputSchema,
  createFinanceAccountInputSchema,
  importTransactionsInputSchema,
  setupMoneyInputSchema,
  splitTransactionInputSchema,
  subscriptionStatusInputSchema,
  subscriptionUsageInputSchema,
  unsplitTransactionInputSchema,
} from "~/types/finance"
import type { CategorizeResult, ImportPreview, ImportPreviewRow, ImportResult, ImportRow } from "~/types/finance"
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
  | "NOT_FOUND"
  | "SPLIT_SUM"
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

// ── Import (§3.2) ───────────────────────────────────────────────────────────

const KEY_CHUNK = 100   // claves por consulta .in(): cabe en la URL de PostgREST
const READ_PAGE = 1000  // max-rows por defecto de PostgREST

type KeyedRow = ImportRow & { importKey: string; counterparty: string }

/** Huella y contraparte calculadas aquí: nunca se fían las del cliente. */
function keyRows(rows: ImportRow[]): KeyedRow[] {
  return withFinanceImportKeys(rows).map(r => ({ ...r, counterparty: normalizeConcept(r.conceptRaw) }))
}

async function ownAccount(supabase: Supabase, userId: string, accountId: string): Promise<boolean> {
  const { data } = await supabase
    .from("finance_accounts").select("id").eq("id", accountId).eq("user_id", userId).maybeSingle()
  return data != null
}

/** import_key → category_id de los movimientos que ya existen en la cuenta. */
async function existingKeys(supabase: Supabase, accountId: string, keys: string[]): Promise<Map<string, string | null> | null> {
  const found = new Map<string, string | null>()
  for (let i = 0; i < keys.length; i += KEY_CHUNK) {
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("import_key, category_id")
      .eq("account_id", accountId)
      .in("import_key", keys.slice(i, i + KEY_CHUNK))
    if (error) {
      console.error(error)
      return null
    }
    for (const row of data ?? []) found.set(row.import_key as string, (row.category_id as string | null) ?? null)
  }
  return found
}

async function loadRules(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from("finance_category_rules").select("id, pattern, category_id, priority").eq("user_id", userId)
  if (error) {
    console.error(error)
    return null
  }
  return (data ?? []).map(r => ({
    id: r.id as string, pattern: r.pattern as string, categoryId: r.category_id as string, priority: r.priority as number,
  }))
}

/** Paso "Review": qué es nuevo, qué está duplicado y qué categoría pondría una regla. No escribe nada. */
export async function previewFinanceImport(input: unknown): Promise<ResultType<ImportPreview, FinanceActionError>> {
  const parsed = importTransactionsInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")
  if (!(await ownAccount(supabase, user.id, parsed.data.accountId))) return createErrorResult("INVALID_INPUT")

  const rows = keyRows(parsed.data.rows)
  const [existing, rules] = await Promise.all([
    existingKeys(supabase, parsed.data.accountId, rows.map(r => r.importKey)),
    loadRules(supabase, user.id),
  ])
  if (!existing || !rules) return createErrorResult("UNKNOWN")

  const fresh = rows.filter(r => !existing.has(r.importKey))
  const assigned = new Map(
    applyRules(
      fresh.map(r => ({ id: r.importKey, counterparty: r.counterparty, categoryId: null, categorySource: null, parentId: null, excluded: false })),
      rules,
    ).map(a => [a.transactionId, a.categoryId]),
  )

  const out: ImportPreviewRow[] = rows.map(r => {
    const duplicate = existing.has(r.importKey)
    return {
      importKey:    r.importKey,
      bookedAt:     r.bookedAt,
      conceptRaw:   r.conceptRaw,
      counterparty: r.counterparty,
      amount:       r.amount,
      balanceAfter: r.balanceAfter,
      status:       duplicate ? "duplicate" : "new",
      categoryId:   duplicate ? existing.get(r.importKey) ?? null : assigned.get(r.importKey) ?? null,
      byRule:       !duplicate && assigned.has(r.importKey),
    }
  })
  return createDataResult({
    rows:       out,
    newCount:   fresh.length,
    duplicates: rows.length - fresh.length,
    noRule:     fresh.length - assigned.size,
  })
}

/**
 * Paso "Confirm" (§3.2.4): upsert por (account_id, import_key) ignorando
 * duplicados, reglas sobre los nuevos y recálculo de suscripciones.
 */
export async function importFinanceTransactions(input: unknown): Promise<ResultType<ImportResult, FinanceActionError>> {
  const parsed = importTransactionsInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const { accountId } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")
  if (!(await ownAccount(supabase, user.id, accountId))) return createErrorResult("INVALID_INPUT")

  const rows = keyRows(parsed.data.rows)
  const inserted: { id: string; counterparty: string | null }[] = []
  for (let i = 0; i < rows.length; i += READ_PAGE) {
    const { data, error } = await supabase
      .from("finance_transactions")
      .upsert(
        rows.slice(i, i + READ_PAGE).map(r => ({
          user_id:       user.id,
          account_id:    accountId,
          booked_at:     r.bookedAt,
          amount:        r.amount,
          concept_raw:   r.conceptRaw,
          counterparty:  r.counterparty,
          balance_after: r.balanceAfter,
          import_key:    r.importKey,
          source:        "import",
        })),
        { onConflict: "account_id,import_key", ignoreDuplicates: true },
      )
      .select("id, counterparty")
    if (error) {
      console.error(error)
      return createErrorResult("UNKNOWN")
    }
    for (const row of data ?? []) inserted.push({ id: row.id as string, counterparty: (row.counterparty as string | null) ?? null })
  }

  const rules = await loadRules(supabase, user.id)
  if (!rules) return createErrorResult("UNKNOWN")
  const assignments = applyRules(
    inserted.map(t => ({ id: t.id, counterparty: t.counterparty, categoryId: null, categorySource: null, parentId: null, excluded: false })),
    rules,
  )
  if (!(await writeRuleAssignments(supabase, user.id, assignments))) return createErrorResult("UNKNOWN")
  await recomputeSubscriptions(supabase, user.id)

  revalidatePath(APP_URLS.MONEY, "layout")
  return createDataResult({ imported: inserted.length, duplicates: rows.length - inserted.length, categorized: assignments.length })
}

/** Escribe lo que categorizan las reglas y suma sus hits (display, §4.2). */
async function writeRuleAssignments(supabase: Supabase, userId: string, assignments: RuleAssignment[]): Promise<boolean> {
  const byRule = new Map<string, { categoryId: string; ids: string[] }>()
  for (const a of assignments) {
    const group = byRule.get(a.ruleId) ?? { categoryId: a.categoryId, ids: [] }
    group.ids.push(a.transactionId)
    byRule.set(a.ruleId, group)
  }
  for (const [ruleId, { categoryId, ids }] of byRule) {
    for (let i = 0; i < ids.length; i += KEY_CHUNK) {
      const { error } = await supabase
        .from("finance_transactions")
        .update({ category_id: categoryId, category_source: "rule" })
        .eq("user_id", userId)
        .in("id", ids.slice(i, i + KEY_CHUNK))
      if (error) {
        console.error(error)
        return false
      }
    }
    const { data: rule } = await supabase.from("finance_category_rules").select("hits").eq("id", ruleId).maybeSingle()
    if (rule) {
      await supabase.from("finance_category_rules").update({ hits: (rule.hits as number) + ids.length }).eq("id", ruleId)
    }
  }
  return true
}

/**
 * §4.3 tras cada import: detecta recurrentes sobre todos los cargos del
 * usuario y hace upsert solo de los campos calculados. status y usage no se
 * envían, así que nunca se pisa lo que el usuario confirmó o marcó.
 */
async function recomputeSubscriptions(supabase: Supabase, userId: string): Promise<void> {
  const charges: { bookedAt: string; amount: number; counterparty: string | null; categoryId: string | null; excluded: boolean }[] = []
  for (let from = 0; ; from += READ_PAGE) {
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("booked_at, amount, counterparty, category_id")
      .eq("user_id", userId)
      .eq("excluded", false)
      .lt("amount", 0)
      .order("booked_at", { ascending: true })
      .range(from, from + READ_PAGE - 1)
    if (error) {
      console.error(error)
      return
    }
    for (const r of data ?? []) {
      charges.push({
        bookedAt: r.booked_at as string, amount: Number(r.amount), counterparty: (r.counterparty as string | null) ?? null,
        categoryId: (r.category_id as string | null) ?? null, excluded: false,
      })
    }
    if (!data || data.length < READ_PAGE) break
  }

  const candidates = detectRecurring(charges)
  if (candidates.length === 0) return
  const { error } = await supabase.from("finance_subscriptions").upsert(
    candidates.map(c => ({
      user_id:       userId,
      counterparty:  c.counterparty,
      amount:        c.amount,
      cadence:       c.cadence,
      category_id:   c.categoryId,
      first_seen:    c.firstSeen,
      last_seen:     c.lastSeen,
      next_expected: c.nextExpected,
      occurrences:   c.occurrences,
      // updated_at no se envía: marca el último cambio del usuario (status /
      // usage) y así sirve para saber si una cancelada ha vuelto a cobrar.
    })),
    { onConflict: "user_id,counterparty,cadence" },
  )
  if (error) console.error(error)
}

// ── Movimientos (§5.2) ──────────────────────────────────────────────────────

/**
 * Reaplica todas las reglas a lo pendiente del usuario (sin categoría o
 * categorizado por regla; nunca manual ni split). Devuelve cuántos cambia.
 */
async function reapplyRules(supabase: Supabase, userId: string): Promise<number | null> {
  const rules = await loadRules(supabase, userId)
  if (!rules) return null
  const targets: { id: string; counterparty: string | null; categoryId: string | null; categorySource: "rule" | null }[] = []
  for (let from = 0; ; from += READ_PAGE) {
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("id, counterparty, category_id, category_source")
      .eq("user_id", userId)
      .is("parent_id", null)
      .eq("excluded", false)
      .or("category_id.is.null,category_source.eq.rule")
      .range(from, from + READ_PAGE - 1)
    if (error) {
      console.error(error)
      return null
    }
    for (const r of data ?? []) {
      targets.push({
        id: r.id as string, counterparty: (r.counterparty as string | null) ?? null,
        categoryId: (r.category_id as string | null) ?? null, categorySource: r.category_source === "rule" ? "rule" : null,
      })
    }
    if (!data || data.length < READ_PAGE) break
  }
  const assignments = applyRules(targets.map(t => ({ ...t, parentId: null, excluded: false })), rules)
  return (await writeRuleAssignments(supabase, userId, assignments)) ? assignments.length : null
}

/**
 * Panel del movimiento: categoría, nota y excluir. Con categoría a mano
 * (source "manual") y, si se pide, crea o actualiza la regla del patrón y la
 * reaplica a todo lo pendiente (§4.2 aprendizaje). En las partes de un split
 * la categoría sigue siendo "split" y no se crean reglas.
 */
export async function categorizeTransaction(input: unknown): Promise<ResultType<CategorizeResult, FinanceActionError>> {
  const parsed = categorizeTransactionInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const data = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: tx, error: readError } = await supabase
    .from("finance_transactions").select("id, parent_id").eq("id", data.transactionId).eq("user_id", user.id).maybeSingle()
  if (readError) {
    console.error(readError)
    return createErrorResult("UNKNOWN")
  }
  if (!tx) return createErrorResult("NOT_FOUND")
  const isPart = tx.parent_id != null

  const { error } = await supabase
    .from("finance_transactions")
    .update({
      category_id:     data.categoryId,
      category_source: data.categoryId == null ? null : isPart ? "split" : "manual",
      notes:           data.notes || null,
      excluded:        isPart ? false : data.excluded,
    })
    .eq("id", data.transactionId)
    .eq("user_id", user.id)
  if (error) {
    console.error(error)
    return createErrorResult("UNKNOWN")
  }

  let ruleCreated = false
  let applied = 0
  if (data.rulePattern && data.categoryId && !isPart) {
    const { error: ruleError } = await supabase.from("finance_category_rules").upsert(
      {
        user_id:      user.id,
        pattern:      normalizeConcept(data.rulePattern),
        category_id:  data.categoryId,
        created_from: data.transactionId,
      },
      { onConflict: "user_id,pattern" },
    )
    if (ruleError) {
      console.error(ruleError)
      return createErrorResult("UNKNOWN")
    }
    ruleCreated = true
    applied = (await reapplyRules(supabase, user.id)) ?? 0
  }

  revalidatePath(APP_URLS.MONEY, "layout")
  return createDataResult({ ruleCreated, applied })
}

/**
 * Dividir (§2.3): N partes con su categoría que suman el importe del padre.
 * El padre queda excluido (conserva su import_key para el dedupe) y cuentan
 * las partes. Dividir otra vez sustituye las partes anteriores.
 */
export async function splitTransaction(input: unknown): Promise<ResultType<{ parts: number }, FinanceActionError>> {
  const parsed = splitTransactionInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const { transactionId, parts } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: parent, error: readError } = await supabase
    .from("finance_transactions")
    .select("id, account_id, booked_at, amount, currency, concept_raw, counterparty, parent_id")
    .eq("id", transactionId).eq("user_id", user.id).maybeSingle()
  if (readError) {
    console.error(readError)
    return createErrorResult("UNKNOWN")
  }
  if (!parent) return createErrorResult("NOT_FOUND")
  if (parent.parent_id != null) return createErrorResult("INVALID_INPUT")   // una parte no se vuelve a dividir

  const cents = (n: number) => Math.round(n * 100)
  if (parts.reduce((a, p) => a + cents(p.amount), 0) !== cents(Number(parent.amount))) return createErrorResult("SPLIT_SUM")

  const { error: deleteError } = await supabase
    .from("finance_transactions").delete().eq("parent_id", transactionId).eq("user_id", user.id)
  if (deleteError) {
    console.error(deleteError)
    return createErrorResult("UNKNOWN")
  }
  const { error: insertError } = await supabase.from("finance_transactions").insert(
    parts.map(p => {
      const id = crypto.randomUUID()
      return {
        id,
        user_id:         user.id,
        account_id:      parent.account_id,
        booked_at:       parent.booked_at,
        amount:          p.amount,
        currency:        parent.currency,
        concept_raw:     parent.concept_raw,
        counterparty:    parent.counterparty,
        category_id:     p.categoryId,
        category_source: "split",
        parent_id:       transactionId,
        source:          "manual",
        import_key:      manualImportKey(id),
      }
    }),
  )
  if (insertError) {
    console.error(insertError)
    return createErrorResult("UNKNOWN")
  }
  const { error: parentError } = await supabase
    .from("finance_transactions").update({ excluded: true }).eq("id", transactionId).eq("user_id", user.id)
  if (parentError) {
    console.error(parentError)
    return createErrorResult("UNKNOWN")
  }

  revalidatePath(APP_URLS.MONEY, "layout")
  return createDataResult({ parts: parts.length })
}

/** Deshace un split: borra las partes y el padre vuelve a contar. */
export async function unsplitTransaction(input: unknown): Promise<ResultType<{ ok: true }, FinanceActionError>> {
  const parsed = unsplitTransactionInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { error } = await supabase
    .from("finance_transactions").delete().eq("parent_id", parsed.data.transactionId).eq("user_id", user.id)
  if (error) {
    console.error(error)
    return createErrorResult("UNKNOWN")
  }
  const { error: parentError } = await supabase
    .from("finance_transactions").update({ excluded: false })
    .eq("id", parsed.data.transactionId).eq("user_id", user.id)
  if (parentError) {
    console.error(parentError)
    return createErrorResult("UNKNOWN")
  }

  revalidatePath(APP_URLS.MONEY, "layout")
  return createDataResult({ ok: true })
}

// ── Suscripciones (§5.3) ────────────────────────────────────────────────────

/** Confirmar, descartar ("Not a subscription"), cancelar o volver a pendiente. */
export async function setSubscriptionStatus(input: unknown): Promise<ResultType<{ ok: true }, FinanceActionError>> {
  const parsed = subscriptionStatusInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { status } = parsed.data
  const { data, error } = await supabase
    .from("finance_subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.subscriptionId)
    .eq("user_id", user.id)
    .select("id, counterparty")
  if (error) {
    console.error(error)
    return createErrorResult("UNKNOWN")
  }
  if (!data || data.length === 0) return createErrorResult("NOT_FOUND")

  // Confirmada o cancelada: lo que cobró es de una suscripción → regla a
  // Subscriptions (cancelar no la quita; y la crea si venía de descartada).
  const counterparty = data[0]!.counterparty as string
  if (status === "confirmed" || status === "cancelled") {
    await addSubscriptionRule(supabase, user.id, parsed.data.subscriptionId, counterparty)
  }
  if (status === "ignored" || status === "pending") await removeSubscriptionRule(supabase, user.id, counterparty)

  revalidatePath(APP_URLS.MONEY, "layout")
  return createDataResult({ ok: true })
}

// Prioridad de la regla de una suscripción confirmada: gana a las reglas
// genéricas del usuario (prioridad 0) sobre el mismo comercio.
const SUBSCRIPTION_RULE_PRIORITY = 10

/** Categoría "Subscriptions" del seed (§2.2); null si el usuario la quitó. */
async function subscriptionsCategoryId(supabase: Supabase, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("finance_categories").select("id").eq("user_id", userId).eq("name", "Subscriptions").eq("kind", "expense").maybeSingle()
  return (data?.id as string | undefined) ?? null
}

/**
 * Suscripción confirmada → regla "contraparte → Subscriptions": categoriza sus
 * cargos pendientes (sin categoría o por regla; nunca lo manual) y los de los
 * próximos imports. MONEY_SPEC.md §2.5.
 */
async function addSubscriptionRule(supabase: Supabase, userId: string, subscriptionId: string, counterparty: string): Promise<void> {
  const categoryId = await subscriptionsCategoryId(supabase, userId)
  if (!categoryId) return
  const { error } = await supabase.from("finance_category_rules").upsert(
    { user_id: userId, pattern: counterparty, category_id: categoryId, priority: SUBSCRIPTION_RULE_PRIORITY },
    { onConflict: "user_id,pattern" },
  )
  if (error) {
    console.error(error)
    return
  }
  await supabase.from("finance_subscriptions").update({ category_id: categoryId }).eq("id", subscriptionId).eq("user_id", userId)
  await reapplyRules(supabase, userId)
}

/**
 * Descartada o devuelta a pendiente → se quita esa regla y lo que categorizó
 * vuelve a la cola (o a otra regla que le encaje). Solo si la regla del
 * comercio es la de la suscripción (apunta a Subscriptions).
 */
async function removeSubscriptionRule(supabase: Supabase, userId: string, counterparty: string): Promise<void> {
  const categoryId = await subscriptionsCategoryId(supabase, userId)
  if (!categoryId) return
  const { data: removed, error } = await supabase
    .from("finance_category_rules").delete()
    .eq("user_id", userId).eq("pattern", counterparty).eq("category_id", categoryId)
    .select("id")
  if (error) {
    console.error(error)
    return
  }
  if (!removed || removed.length === 0) return
  const { error: resetError } = await supabase
    .from("finance_transactions")
    .update({ category_id: null, category_source: null })
    .eq("user_id", userId)
    .eq("category_source", "rule")
    .eq("category_id", categoryId)
    .like("counterparty", `%${counterparty.replace(/[%_]/g, "\\$&")}%`)
  if (resetError) {
    console.error(resetError)
    return
  }
  await reapplyRules(supabase, userId)
}

/** Uso marcado por el usuario; "unused" guarda desde cuándo (candidatas a cancelar). */
export async function setSubscriptionUsage(input: unknown): Promise<ResultType<{ ok: true }, FinanceActionError>> {
  const parsed = subscriptionUsageInputSchema.safeParse(input)
  if (!parsed.success) return createErrorResult("INVALID_INPUT")
  const { subscriptionId, usage } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: current, error: readError } = await supabase
    .from("finance_subscriptions").select("usage, unused_since").eq("id", subscriptionId).eq("user_id", user.id).maybeSingle()
  if (readError) {
    console.error(readError)
    return createErrorResult("UNKNOWN")
  }
  if (!current) return createErrorResult("NOT_FOUND")

  // Si ya estaba sin usar, se conserva desde cuándo.
  const unusedSince = usage !== "unused" ? null
    : current.usage === "unused" && current.unused_since ? current.unused_since as string
    : new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from("finance_subscriptions")
    .update({ usage, unused_since: unusedSince, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
  if (error) {
    console.error(error)
    return createErrorResult("UNKNOWN")
  }

  revalidatePath(APP_URLS.MONEY, "layout")
  return createDataResult({ ok: true })
}
