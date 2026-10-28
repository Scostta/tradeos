import { z } from "zod"

// Módulo Money (MONEY_SPEC.md). Tablas finance_*; nada de aquí se relaciona
// con Trading ni con Invest. Importes en EUR, firmados (negativo = sale).

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timestamp = z.string().datetime({ offset: true })
const money = z.number()

// ── Cuentas (§2.1) ──────────────────────────────────────────────────────────

export const financeAccountKindSchema = z.enum(["checking", "savings", "broker", "cash"])
export type FinanceAccountKind = z.infer<typeof financeAccountKindSchema>

export const financeAccountSchema = z.object({
  id:        z.string().uuid(),
  userId:    z.string().uuid(),
  name:      z.string(),
  kind:      financeAccountKindSchema,
  currency:  z.string(),
  ibanLast4: z.string().nullable(),   // solo display; nunca el IBAN completo
  active:    z.boolean(),
  createdAt: timestamp,
})
export type FinanceAccount = z.infer<typeof financeAccountSchema>

// ── Categorías (§2.2) ───────────────────────────────────────────────────────

export const categoryKindSchema = z.enum(["expense", "income", "transfer", "savings"])
export type CategoryKind = z.infer<typeof categoryKindSchema>

export const financeCategorySchema = z.object({
  id:       z.string().uuid(),
  userId:   z.string().uuid(),
  name:     z.string(),
  kind:     categoryKindSchema,
  isFixed:  z.boolean(),
  color:    z.string(),
  sort:     z.number().int(),
  archived: z.boolean(),
})
export type FinanceCategory = z.infer<typeof financeCategorySchema>

// ── Movimientos (§2.3) ──────────────────────────────────────────────────────

export const categorySourceSchema = z.enum(["rule", "manual", "split"])
export type CategorySource = z.infer<typeof categorySourceSchema>

export const financeTransactionSchema = z.object({
  id:             z.string().uuid(),
  userId:         z.string().uuid(),
  accountId:      z.string().uuid(),
  bookedAt:       isoDate,
  amount:         money,
  currency:       z.string(),
  conceptRaw:     z.string(),
  counterparty:   z.string().nullable(),
  balanceAfter:   money.nullable(),
  categoryId:     z.string().uuid().nullable(),
  categorySource: categorySourceSchema.nullable(),
  excluded:       z.boolean(),
  parentId:       z.string().uuid().nullable(),
  notes:          z.string().nullable(),
  source:         z.enum(["import", "manual"]),
  importKey:      z.string(),
  createdAt:      timestamp,
})
export type FinanceTransaction = z.infer<typeof financeTransactionSchema>

// ── Reglas (§2.4) ───────────────────────────────────────────────────────────

export const financeRuleSchema = z.object({
  id:          z.string().uuid(),
  userId:      z.string().uuid(),
  pattern:     z.string(),
  categoryId:  z.string().uuid(),
  priority:    z.number().int(),
  createdFrom: z.string().uuid().nullable(),
  hits:        z.number().int(),
  createdAt:   timestamp,
})
export type FinanceRule = z.infer<typeof financeRuleSchema>

// ── Suscripciones (§2.5) ────────────────────────────────────────────────────

export const cadenceSchema = z.enum(["weekly", "monthly", "quarterly", "yearly"])
export const subscriptionStatusSchema = z.enum(["pending", "confirmed", "cancelled", "ignored"])
export const subscriptionUsageSchema = z.enum(["unknown", "used", "unused", "fixed"])

export const financeSubscriptionSchema = z.object({
  id:           z.string().uuid(),
  userId:       z.string().uuid(),
  counterparty: z.string(),
  amount:       money,                 // positivo
  cadence:      cadenceSchema,
  categoryId:   z.string().uuid().nullable(),
  firstSeen:    isoDate,
  lastSeen:     isoDate,
  nextExpected: isoDate.nullable(),
  occurrences:  z.number().int(),
  status:       subscriptionStatusSchema,
  usage:        subscriptionUsageSchema,
  unusedSince:  isoDate.nullable(),
  updatedAt:    timestamp,
})
export type FinanceSubscription = z.infer<typeof financeSubscriptionSchema>

// ── Objetivos (§2.6) ────────────────────────────────────────────────────────

export const financeGoalSchema = z.object({
  id:           z.string().uuid(),
  userId:       z.string().uuid(),
  name:         z.string(),
  targetAmount: money,
  savedAmount:  money,
  monthlyAlloc: money,
  priority:     z.number().int(),
  deadline:     isoDate.nullable(),
  status:       z.enum(["active", "completed", "archived"]),
  createdAt:    timestamp,
})
export type FinanceGoal = z.infer<typeof financeGoalSchema>

// ── Ajustes (§2.7) ──────────────────────────────────────────────────────────

export const financeSettingsSchema = z.object({
  userId:         z.string().uuid(),
  monthStartDay:  z.number().int().min(1).max(28),
  defaultAccount: z.string().uuid().nullable(),
  createdAt:      timestamp,
})
export type FinanceSettings = z.infer<typeof financeSettingsSchema>

// ── Inputs de server actions ────────────────────────────────────────────────

const ibanLast4 = z.string().trim().regex(/^\d{4}$/).nullable()

/** Alta de Money: la cuenta principal (además se crean Cash y el seed de categorías). */
export const setupMoneyInputSchema = z.object({
  accountName: z.string().trim().min(1).max(60),
  accountKind: financeAccountKindSchema.exclude(["cash"]),
  ibanLast4,
})
export type SetupMoneyInput = z.infer<typeof setupMoneyInputSchema>

export const createFinanceAccountInputSchema = setupMoneyInputSchema
export type CreateFinanceAccountInput = z.infer<typeof createFinanceAccountInputSchema>

// ── Import (§3) ─────────────────────────────────────────────────────────────

export const MAX_IMPORT_ROWS = 5000

/** Una fila ya leída por el parser (en el cliente). La huella se recalcula en el servidor. */
export const importRowSchema = z.object({
  bookedAt:     isoDate,
  conceptRaw:   z.string().trim().min(1).max(500),
  amount:       z.number().finite(),
  balanceAfter: z.number().finite().nullable(),
})
export type ImportRow = z.infer<typeof importRowSchema>

export const importTransactionsInputSchema = z.object({
  accountId: z.string().uuid(),
  rows:      z.array(importRowSchema).min(1).max(MAX_IMPORT_ROWS),
})
export type ImportTransactionsInput = z.infer<typeof importTransactionsInputSchema>

export type ImportPreviewRow = {
  importKey:    string
  bookedAt:     string
  conceptRaw:   string
  counterparty: string
  amount:       number
  balanceAfter: number | null
  status:       "new" | "duplicate"
  categoryId:   string | null   // nuevo: la que pondría una regla; duplicado: la que ya tiene
  byRule:       boolean
}

export type ImportPreview = {
  rows:       ImportPreviewRow[]   // en el orden del fichero
  newCount:   number
  duplicates: number
  noRule:     number               // nuevos sin regla que los categorice
}

export type ImportResult = {
  imported:    number
  duplicates:  number
  categorized: number
}

// ── Movimientos: categorizar, excluir, dividir (§5.2) ───────────────────────

export const categorizeTransactionInputSchema = z.object({
  transactionId: z.string().uuid(),
  categoryId:    z.string().uuid().nullable(),
  notes:         z.string().trim().max(500).nullable(),
  excluded:      z.boolean(),
  // Regla a crear con esta categoría (§4.2 aprendizaje); null = no crear.
  rulePattern:   z.string().trim().min(2).max(100).nullable(),
})
export type CategorizeTransactionInput = z.infer<typeof categorizeTransactionInputSchema>

export type CategorizeResult = {
  ruleCreated: boolean
  applied:     number   // movimientos pendientes que la regla ha categorizado además de este
}

export const splitTransactionInputSchema = z.object({
  transactionId: z.string().uuid(),
  parts: z.array(z.object({
    categoryId: z.string().uuid(),
    amount:     z.number().finite().refine(n => n !== 0),
  })).min(2).max(10),
})
export type SplitTransactionInput = z.infer<typeof splitTransactionInputSchema>

export const unsplitTransactionInputSchema = z.object({ transactionId: z.string().uuid() })
